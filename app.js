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

// Elementi del modale
const modal = document.getElementById('appointment-modal');
const modalTitle = document.getElementById('modal-title');
const appointmentForm = document.getElementById('appointment-form');
const appointmentIdInput = document.getElementById('appointment-id');
const studentSelect = document.getElementById('student-select');
const teacherSelectContainer = document.getElementById('teacher-select-container');
const teacherSelect = document.getElementById('teacher-select');
const classroomSelect = document.getElementById('classroom-select');
const appointmentTime = document.getElementById('appointment-time');
const appointmentNotes = document.getElementById('appointment-notes');
const saveButton = document.getElementById('save-appointment-button');
const cancelButton = document.getElementById('cancel-modal-button');
const deleteButton = document.getElementById('delete-appointment-button');


// --- VARIABILI GLOBALI DI STATO ---
let calendar;
let currentUser = null;
let currentUserRole = null;
let newAppointmentInfo = null; // Per memorizzare data/ora del nuovo appuntamento

// --- LOGICA DI AUTENTICAZIONE ---

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = event.target.email.value;
    const password = event.target.password.value;
    loginError.textContent = '';
    const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error) {
        loginError.textContent = 'Credenziali non valide. Riprova.';
        console.error('Login error:', error.message);
    } else if (data.user) {
        currentUser = data.user;
        await loadUserDataAndRenderUI(data.user);
    }
});

logoutButton.addEventListener('click', async () => {
    await sbClient.auth.signOut();
    currentUser = null;
    currentUserRole = null;
    if (calendar) calendar.destroy();
    showLoginScreen();
});

function showLoginScreen() {
    appSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    userEmailSpan.textContent = '';
}

function showAppScreen(user) {
    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    userEmailSpan.textContent = user.email;
}

async function loadUserDataAndRenderUI(user) {
    showAppScreen(user);
    const { data: profile, error } = await sbClient.from('profiles').select('ruolo').eq('id', user.id).single();
    if (error) {
        console.error("Errore nel caricare il profilo utente:", error);
        loginError.textContent = "Impossibile caricare il profilo utente. Errore: " + error.message;
        await sbClient.auth.signOut();
        showLoginScreen();
        return;
    }
    currentUserRole = profile.ruolo;
    updateNavigation(profile.ruolo);
    initializeCalendar(user, profile.ruolo);
    console.log(`Utente loggato con ruolo: ${profile.ruolo}`);
}

function updateNavigation(role) {
    const existingAdminLink = document.getElementById('admin-link');
    if (existingAdminLink) existingAdminLink.remove();
    if (role === 'admin') {
        const adminLink = document.createElement('a');
        adminLink.href = '#';
        adminLink.id = 'admin-link';
        adminLink.className = 'block px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md';
        adminLink.textContent = 'Amministrazione';
        appNavigation.appendChild(adminLink);
    }
}

async function checkUserSession() {
    const { data: { session } } = await sbClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserDataAndRenderUI(session.user);
    } else {
        showLoginScreen();
    }
}


// --- LOGICA DEL CALENDARIO ---

async function fetchEvents(user, role) {
    let allEvents = [];

    let query;
    const selectString = '*, studente_id(id, nome), insegnante_id(id, nome), aula_id(id, nome)';

    if (role === 'admin') {
        query = sbClient.from('appuntamenti').select(selectString);
    } else if (role === 'student') {
        query = sbClient.from('appuntamenti').select(selectString).eq('studente_id', user.id);
    } else { // 'teacher'
        query = sbClient.from('appuntamenti').select(selectString).eq('insegnante_id', user.id);
    }
    
    const { data, error } = await query;
    if (error) {
        console.error("Errore nel caricare gli appuntamenti:", error);
        return [];
    }

    const mainEvents = data.map(apt => ({
        id: apt.id,
        title: `${apt.studente_id.nome} con ${apt.insegnante_id.nome}`,
        start: apt.data_inizio,
        end: apt.data_fine,
        extendedProps: {
            notes: apt.note,
            studentId: apt.studente_id.id,
            teacherId: apt.insegnante_id.id,
            classroomId: apt.aula_id.id,
            studentName: apt.studente_id.nome,
            teacherName: apt.insegnante_id.nome,
            classroomName: apt.aula_id.nome,
        }
    }));
    allEvents.push(...mainEvents);

    if (role === 'teacher') {
        const { data: occupied, error: occupiedError } = await sbClient.rpc('get_occupied_slots');
        if (occupiedError) {
            console.error("Errore nel caricare gli slot occupati:", occupiedError);
        } else {
            const occupiedEvents = occupied
                .filter(slot => slot.insegnante_id !== user.id) 
                .map(slot => ({
                    title: 'Occupato',
                    start: slot.data_inizio,
                    end: slot.data_fine,
                    display: 'background',
                    color: '#e5e7eb'
                }));
            allEvents.push(...occupiedEvents);
        }
    }
    
    return allEvents;
}


function initializeCalendar(user, role) {
    const calendarEl = document.getElementById('calendar');
    if (calendar) {
        calendar.destroy();
    }

    const isEditable = role === 'admin' || role === 'teacher';

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        locale: 'it',
        slotMinTime: '08:00:00',
        slotMaxTime: '21:00:00',
        allDaySlot: false,
        selectable: isEditable,
        editable: isEditable,
        events: (fetchInfo, successCallback, failureCallback) => {
            fetchEvents(user, role)
                .then(events => successCallback(events))
                .catch(error => failureCallback(error));
        },
        select: (info) => {
            if (!isEditable) return;
            newAppointmentInfo = info;
            openModalForNew();
        },
        eventClick: (info) => {
            if (info.event.display === 'background') return;
            openModalForEdit(info.event);
        }
    });

    calendar.render();
}


// --- LOGICA DEL MODALE ---

async function openModalForNew() {
    appointmentForm.reset();
    modalTitle.textContent = 'Nuovo Appuntamento';
    appointmentIdInput.value = '';
    deleteButton.classList.add('hidden');

    if (currentUserRole === 'admin') {
        teacherSelectContainer.classList.remove('hidden');
        teacherSelect.required = true;
    } else {
        teacherSelectContainer.classList.add('hidden');
        teacherSelect.required = false;
    }

    const { start, end } = newAppointmentInfo;
    appointmentTime.textContent = `${start.toLocaleDateString('it-IT')} dalle ${start.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})} alle ${end.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}`;
    
    await populateSelects();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function openModalForEdit(event) {
    appointmentForm.reset();
    modalTitle.textContent = 'Dettagli Appuntamento';
    
    if (currentUserRole === 'admin') {
        teacherSelectContainer.classList.remove('hidden');
        teacherSelect.required = true;
    } else {
        teacherSelectContainer.classList.add('hidden');
        teacherSelect.required = false;
    }

    if(currentUserRole === 'admin' || (currentUserRole === 'teacher' && event.extendedProps.teacherId === currentUser.id)) {
        deleteButton.classList.remove('hidden');
    } else {
        deleteButton.classList.add('hidden');
    }

    const { start, end, extendedProps, id } = event;
    appointmentIdInput.value = id;
    appointmentTime.textContent = `${start.toLocaleDateString('it-IT')} dalle ${start.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})} alle ${end.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}`;
    appointmentNotes.value = extendedProps.notes || '';
    
    await populateSelects(extendedProps.studentId, extendedProps.classroomId, extendedProps.teacherId);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}


async function populateSelects(selectedStudentId = null, selectedClassroomId = null, selectedTeacherId = null) {
    // Popola studenti
    const { data: students, error: studentsError } = await sbClient.from('profiles').select('id, nome').eq('ruolo', 'student');
    if (studentsError) console.error("Errore nel caricare gli studenti:", studentsError);
    else {
        studentSelect.innerHTML = '<option value="">Seleziona uno studente</option>';
        students.forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = s.nome;
            if (s.id === selectedStudentId) option.selected = true;
            studentSelect.appendChild(option);
        });
    }
    
    // Popola insegnanti (se l'utente è admin)
    if (currentUserRole === 'admin') {
        const { data: teachers, error: teachersError } = await sbClient.from('profiles').select('id, nome').eq('ruolo', 'teacher');
        if (teachersError) console.error("Errore nel caricare gli insegnanti:", teachersError);
        else {
            teacherSelect.innerHTML = '<option value="">Seleziona un insegnante</option>';
            teachers.forEach(t => {
                const option = document.createElement('option');
                option.value = t.id;
                option.textContent = t.nome;
                if (t.id === selectedTeacherId) option.selected = true;
                teacherSelect.appendChild(option);
            });
        }
    }

    // Popola aule
    const { data: classrooms, error: classroomsError } = await sbClient.from('aule').select('id, nome');
    if (classroomsError) console.error("Errore nel caricare le aule:", classroomsError);
    else {
        classroomSelect.innerHTML = '<option value="">Seleziona un\'aula</option>';
        classrooms.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.nome;
            if (c.id === selectedClassroomId) option.selected = true;
            classroomSelect.appendChild(option);
        });
    }
}


function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    newAppointmentInfo = null;
}

cancelButton.addEventListener('click', closeModal);

appointmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = appointmentIdInput.value;
    const appointmentData = {
        studente_id: studentSelect.value,
        aula_id: classroomSelect.value,
        note: appointmentNotes.value,
        insegnante_id: currentUserRole === 'admin' ? teacherSelect.value : currentUser.id,
    };

    let error;
    if (id) {
        // Modifica appuntamento esistente
        const { error: updateError } = await sbClient.from('appuntamenti').update(appointmentData).eq('id', id);
        error = updateError;
    } else {
        // Crea nuovo appuntamento
        appointmentData.data_inizio = newAppointmentInfo.startStr;
        appointmentData.data_fine = newAppointmentInfo.endStr;
        const { error: insertError } = await sbClient.from('appuntamenti').insert(appointmentData);
        error = insertError;
    }

    if (error) {
        alert("Errore nel salvare l'appuntamento: " + error.message);
        console.error(error);
    } else {
        closeModal();
        calendar.refetchEvents();
    }
});

deleteButton.addEventListener('click', async () => {
    const id = appointmentIdInput.value;
    if(!id) return;
    
    const isConfirmed = window.confirm("Sei sicuro di voler eliminare questo appuntamento?");

    if(isConfirmed) {
        const { error } = await sbClient.from('appuntamenti').delete().eq('id', id);
        if(error) {
            alert("Errore durante l'eliminazione: " + error.message);
            console.error(error);
        } else {
            closeModal();
            calendar.refetchEvents();
        }
    }
});


// --- INIZIALIZZAZIONE DELL'APP ---
checkUserSession();

