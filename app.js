import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// --- CONFIGURAZIONE SUPABASE ---
const SUPABASE_URL = 'https://nxkcnjzkjboorltirjad.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a2NuanpramJvb3JsdGlyamFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MDkyNzAsImV4cCI6MjA3MjM4NTI3MH0.E1tK4QOlhpTPMtmYLRZtTvDy5QT_wej25cZAMkBh4CM';
const sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- RIFERIMENTI AGLI ELEMENTI DEL DOM ---
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userEmailSpan = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-button');
const appNavigation = document.getElementById('app-navigation');
const calendarEl = document.getElementById('calendar');
// Elementi del modale
const appointmentModal = document.getElementById('appointment-modal');
const appointmentModalBackdrop = document.getElementById('appointment-modal-backdrop');
const modalCloseButton = document.getElementById('modal-close-button');
const modalCancelButton = document.getElementById('modal-cancel-button');
const appointmentForm = document.getElementById('appointment-form');
const modalTitle = document.getElementById('modal-title');
const modalTimeDisplay = document.getElementById('modal-time-display');
const teacherSelectContainer = document.getElementById('teacher-select-container');
const teacherSelect = document.getElementById('teacher-select');
const studentSelect = document.getElementById('student-select');
const aulaSelect = document.getElementById('aula-select');
const noteTextarea = document.getElementById('note-textarea');
const appointmentIdInput = document.getElementById('appointment-id');

let calendar; 
let currentUser = null; 
let currentUserRole = null; 
let selectedDateInfo = null; // Memorizza le info della data selezionata

// --- GESTIONE AUTENTICAZIONE E UI ---

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.textContent = '';
    const email = event.target.email.value;
    const password = event.target.password.value;
    
    const { data, error } = await sbClient.auth.signInWithPassword({ email, password });

    if (error) {
        loginError.textContent = 'Credenziali non valide. Riprova.';
        console.error('Login error:', error.message);
    } else if (data.user) {
        await loadUserDataAndRenderUI(data.user);
    }
});

logoutButton.addEventListener('click', async () => {
    await sbClient.auth.signOut();
    if (calendar) {
        calendar.destroy();
        calendar = null;
    }
    currentUser = null;
    currentUserRole = null;
    showLoginScreen();
});

function showLoginScreen() {
    appSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    userEmailSpan.textContent = '';
    const adminLink = document.getElementById('admin-link');
    if (adminLink) adminLink.remove();
}

function showAppScreen(user) {
    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    userEmailSpan.textContent = user.email;
}

async function loadUserDataAndRenderUI(user) {
    const { data: profile, error } = await sbClient.from('profiles').select('ruolo').eq('id', user.id).single();
    
    if (error) {
        console.error("Errore nel caricare il profilo utente:", error);
        loginError.textContent = `Impossibile caricare il profilo: ${error.message}`;
        await sbClient.auth.signOut();
        showLoginScreen();
        return;
    }
    
    currentUser = user;
    currentUserRole = profile.ruolo;
    
    showAppScreen(user);
    
    const existingAdminLink = document.getElementById('admin-link');
    if (existingAdminLink) existingAdminLink.remove();
    if (currentUserRole === 'admin') {
        const adminLink = document.createElement('a');
        adminLink.href = '#';
        adminLink.id = 'admin-link';
        adminLink.className = 'block px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md';
        adminLink.textContent = 'Amministrazione';
        appNavigation.appendChild(adminLink);
    }
    
    initializeCalendar();
}

async function checkUserSession() {
    const { data: { session } } = await sbClient.auth.getSession();
    if (session) {
        await loadUserDataAndRenderUI(session.user);
    } else {
        showLoginScreen();
    }
}

// --- GESTIONE MODALE APPUNTAMENTI ---

function openAppointmentModal() {
    appointmentModal.classList.remove('hidden');
}

function closeAppointmentModal() {
    appointmentModal.classList.add('hidden');
    appointmentForm.reset();
    selectedDateInfo = null;
}

modalCloseButton.addEventListener('click', closeAppointmentModal);
modalCancelButton.addEventListener('click', closeAppointmentModal);
appointmentModalBackdrop.addEventListener('click', closeAppointmentModal);

async function populateModalDropdowns() {
    // Popola studenti
    const { data: students, error: studentsError } = await sbClient.from('profiles').select('id, nome').eq('ruolo', 'student');
    if (studentsError) throw studentsError;
    studentSelect.innerHTML = '<option value="">Seleziona studente...</option>';
    students.forEach(s => studentSelect.innerHTML += `<option value="${s.id}">${s.nome}</option>`);

    // Popola aule
    const { data: aule, error: auleError } = await sbClient.from('aule').select('id, nome');
    if (auleError) throw auleError;
    aulaSelect.innerHTML = '<option value="">Seleziona aula...</option>';
    aule.forEach(a => aulaSelect.innerHTML += `<option value="${a.id}">${a.nome}</option>`);

    // Popola insegnanti (solo per admin)
    if (currentUserRole === 'admin') {
        teacherSelectContainer.classList.remove('hidden');
        const { data: teachers, error: teachersError } = await sbClient.from('profiles').select('id, nome').eq('ruolo', 'teacher');
        if (teachersError) throw teachersError;
        teacherSelect.innerHTML = '<option value="">Seleziona insegnante...</option>';
        teachers.forEach(t => teacherSelect.innerHTML += `<option value="${t.id}">${t.nome}</option>`);
    } else {
        teacherSelectContainer.classList.add('hidden');
    }
}

appointmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedDateInfo) return;

    const newAppointment = {
        studente_id: studentSelect.value,
        aula_id: aulaSelect.value,
        note: noteTextarea.value,
        data_inizio: selectedDateInfo.startStr,
        data_fine: selectedDateInfo.endStr,
        insegnante_id: currentUserRole === 'admin' ? teacherSelect.value : currentUser.id,
    };

    if (currentUserRole === 'admin' && !newAppointment.insegnante_id) {
        alert("Per favore, seleziona un insegnante.");
        return;
    }

    const { error } = await sbClient.from('appuntamenti').insert([newAppointment]);

    if (error) {
        console.error("Errore nel salvare l'appuntamento:", error);
        alert(`Errore: ${error.message}`);
    } else {
        closeAppointmentModal();
        calendar.refetchEvents();
    }
});


// --- GESTIONE CALENDARIO ---

async function handleDateSelect(info) {
    selectedDateInfo = info;
    appointmentForm.reset();
    appointmentIdInput.value = '';
    modalTitle.textContent = 'Nuovo Appuntamento';
    modalTimeDisplay.textContent = `Dalle ${info.start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} alle ${info.end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} del ${info.start.toLocaleDateString('it-IT')}`;
    
    try {
        await populateModalDropdowns();
        openAppointmentModal();
    } catch (error) {
        console.error("Errore nel popolare i dati del modale:", error);
        alert("Impossibile caricare i dati per la creazione dell'appuntamento.");
    }
}

async function initializeCalendar() {
    if (calendar) {
        calendar.destroy();
    }

    const isMobile = window.innerWidth < 768;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: isMobile ? 'timeGridDay' : 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: isMobile ? 'timeGridDay,timeGridWeek' : 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        locale: 'it',
        slotMinTime: '08:00:00',
        slotMaxTime: '21:00:00',
        allDaySlot: false,
        height: 'auto',
        selectable: currentUserRole === 'admin' || currentUserRole === 'teacher',
        select: handleDateSelect,
        events: async (fetchInfo, successCallback, failureCallback) => {
            try {
                let allEvents = [];
                // Admin vede tutto
                if (currentUserRole === 'admin') {
                    const { data, error } = await sbClient.from('appuntamenti').select('*, studente_id(nome), insegnante_id(nome), aula_id(nome)');
                    if (error) throw error;
                    allEvents = data.map(apt => ({
                        id: apt.id,
                        title: `${apt.studente_id.nome} con ${apt.insegnante_id.nome}`,
                        start: apt.data_inizio,
                        end: apt.data_fine,
                        extendedProps: { aula: apt.aula_id.nome, note: apt.note }
                    }));
                }
                // Studente vede solo i suoi
                else if (currentUserRole === 'student') {
                    const { data, error } = await sbClient.from('appuntamenti').select('*, insegnante_id(nome), aula_id(nome)').eq('studente_id', currentUser.id);
                    if (error) throw error;
                    allEvents = data.map(apt => ({
                        id: apt.id,
                        title: `Lezione con ${apt.insegnante_id.nome}`,
                        start: apt.data_inizio,
                        end: apt.data_fine,
                        extendedProps: { aula: apt.aula_id.nome, note: apt.note }
                    }));
                }
                // Insegnante vede i suoi + slot occupati
                else if (currentUserRole === 'teacher') {
                    const { data: myAppointments, error: myAppointmentsError } = await sbClient.from('appuntamenti').select('*, studente_id(nome), aula_id(nome)').eq('insegnante_id', currentUser.id);
                    if (myAppointmentsError) throw myAppointmentsError;
                    
                    const teacherEvents = myAppointments.map(apt => ({
                        id: apt.id,
                        title: `Lezione con ${apt.studente_id.nome}`,
                        start: apt.data_inizio,
                        end: apt.data_fine,
                        extendedProps: { aula: apt.aula_id.nome, note: apt.note }
                    }));

                    const { data: occupiedSlots, error: slotsError } = await sbClient.rpc('get_occupied_slots');
                    if (slotsError) throw slotsError;
                    
                    const occupiedEvents = occupiedSlots
                        .filter(slot => slot.insegnante_id !== currentUser.id) 
                        .map(slot => ({
                            title: 'Occupato',
                            start: slot.data_inizio,
                            end: slot.data_fine,
                            display: 'background',
                            color: '#e5e7eb'
                        }));

                    allEvents = [...teacherEvents, ...occupiedEvents];
                }
                successCallback(allEvents);
            } catch (error) {
                console.error("Errore nel caricare gli appuntamenti:", error);
                failureCallback(error);
            }
        }
    });

    calendar.render();
}

window.addEventListener('resize', () => {
    if (calendar) {
        setTimeout(() => {
            if(calendar) { // Ricontrolla se esiste ancora dopo il timeout
               calendar.destroy();
               initializeCalendar();
            }
        }, 250);
    }
});


// --- AVVIO APPLICAZIONE ---
checkUserSession();

