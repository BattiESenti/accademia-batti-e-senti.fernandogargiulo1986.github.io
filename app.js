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

let calendar; // Variabile globale per l'istanza del calendario
let currentUser = null; // Memorizza l'utente corrente
let currentUserRole = null; // Memorizza il ruolo dell'utente corrente

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
    
    // Mostra/nascondi link amministrazione
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

// --- GESTIONE CALENDARIO ---

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
        height: 'auto', // Migliora la gestione dell'altezza su mobile
        events: async (fetchInfo, successCallback, failureCallback) => {
            try {
                let allEvents = [];
                // Admin vede tutto, con nomi di studenti e insegnanti
                if (currentUserRole === 'admin') {
                    const { data, error } = await sbClient.from('appuntamenti').select('*, studente_id(nome), insegnante_id(nome), aula_id(nome)');
                    if (error) throw error;
                    allEvents = data.map(apt => ({
                        id: apt.id,
                        title: `${apt.studente_id.nome} con ${apt.insegnante_id.nome}`,
                        start: apt.data_inizio,
                        end: apt.data_fine,
                        extendedProps: {
                            aula: apt.aula_id.nome,
                            note: apt.note
                        }
                    }));
                }
                // Studente vede solo i suoi appuntamenti
                else if (currentUserRole === 'student') {
                    const { data, error } = await sbClient.from('appuntamenti').select('*, insegnante_id(nome), aula_id(nome)').eq('studente_id', currentUser.id);
                    if (error) throw error;
                    allEvents = data.map(apt => ({
                        id: apt.id,
                        title: `Lezione con ${apt.insegnante_id.nome}`,
                        start: apt.data_inizio,
                        end: apt.data_fine,
                        extendedProps: {
                            aula: apt.aula_id.nome,
                            note: apt.note
                        }
                    }));
                }
                // Insegnante vede i suoi appuntamenti + slot occupati
                else if (currentUserRole === 'teacher') {
                    // 1. Carica i propri appuntamenti
                    const { data: myAppointments, error: myAppointmentsError } = await sbClient.from('appuntamenti').select('*, studente_id(nome), aula_id(nome)').eq('insegnante_id', currentUser.id);
                    if (myAppointmentsError) throw myAppointmentsError;
                    
                    const teacherEvents = myAppointments.map(apt => ({
                        id: apt.id,
                        title: `Lezione con ${apt.studente_id.nome}`,
                        start: apt.data_inizio,
                        end: apt.data_fine,
                        extendedProps: {
                            aula: apt.aula_id.nome,
                            note: apt.note
                        }
                    }));

                    // 2. Carica gli slot occupati dagli altri
                    const { data: occupiedSlots, error: slotsError } = await sbClient.rpc('get_occupied_slots');
                    if (slotsError) throw slotsError;
                    
                    const occupiedEvents = occupiedSlots
                        .filter(slot => slot.insegnante_id !== currentUser.id) // Escludi i tuoi slot
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

// Ridisegna il calendario se la finestra viene ridimensionata
window.addEventListener('resize', () => {
    if (calendar) {
        // Un piccolo timeout per evitare di ridisegnare troppe volte
        setTimeout(() => {
            calendar.destroy();
            initializeCalendar();
        }, 250);
    }
});


// --- AVVIO APPLICAZIONE ---
checkUserSession();

