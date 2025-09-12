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

// Viste principali
const calendarView = document.getElementById('calendar-view');
const adminView = document.getElementById('admin-view');

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

// Elementi Admin
const adminTabs = {
    students: document.getElementById('tab-students'),
    teachers: document.getElementById('tab-teachers'),
    classrooms: document.getElementById('tab-classrooms'),
};
const adminContents = {
    students: document.getElementById('admin-content-students'),
    teachers: document.getElementById('admin-content-teachers'),
    classrooms: document.getElementById('admin-content-classrooms'),
};
const tableBodies = {
    students: document.getElementById('students-table-body'),
    teachers: document.getElementById('teachers-table-body'),
    classrooms: document.getElementById('classrooms-table-body'),
};


// --- VARIABILI GLOBALI DI STATO ---
let calendar;
let currentUser = null;
let currentUserRole = null;
let newAppointmentInfo = null;

// --- LOGICA DI AUTENTICAZIONE E UI PRINCIPALE---

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
    showView('calendar'); // Mostra il calendario di default
    console.log(`Utente loggato con ruolo: ${profile.ruolo}`);
}

function updateNavigation(role) {
    // Rimuovi link admin esistente se c'è
    const existingAdminLink = document.getElementById('nav-admin');
    if (existingAdminLink) existingAdminLink.remove();

    // Aggiungi link admin se l'utente è admin
    if (role === 'admin') {
        const adminLink = document.createElement('a');
        adminLink.href = '#';
        adminLink.id = 'nav-admin';
        adminLink.className = 'nav-link block px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md';
        adminLink.textContent = 'Amministrazione';
        appNavigation.appendChild(adminLink);
    }
    
    // Aggiungi event listeners per la navigazione
    setupEventListeners();
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


// --- GESTIONE VISTE E NAVIGAZIONE ---

function showView(viewName) {
    // Nascondi tutte le viste
    calendarView.classList.add('hidden');
    adminView.classList.add('hidden');

    // Rimuovi la classe 'active' da tutti i link di navigazione
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    // Mostra la vista richiesta e imposta il link attivo
    if (viewName === 'calendar') {
        calendarView.classList.remove('hidden');
        document.getElementById('nav-calendar').classList.add('active');
    } else if (viewName === 'admin') {
        adminView.classList.remove('hidden');
        const adminLink = document.getElementById('nav-admin');
        if (adminLink) adminLink.classList.add('active');
        loadAdminData(); // Carica i dati quando la vista viene mostrata
    }
}

function setupEventListeners() {
    document.getElementById('nav-calendar').addEventListener('click', (e) => {
        e.preventDefault();
        showView('calendar');
    });

    const adminLink = document.getElementById('nav-admin');
    if (adminLink) {
        adminLink.addEventListener('click', (e) => {
            e.preventDefault();
            showView('admin');
        });
    }

    // Aggiungi listener per i tab del pannello admin
    Object.keys(adminTabs).forEach(key => {
        adminTabs[key].addEventListener('click', () => showAdminTab(key));
    });
}

// --- LOGICA PANNELLO DI AMMINISTRAZIONE ---

function showAdminTab(tabName) {
    // Gestione stile tab
    Object.values(adminTabs).forEach(tab => {
        tab.classList.remove('text-indigo-600', 'border-indigo-500');
        tab.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'border-transparent');
    });
    adminTabs[tabName].classList.add('text-indigo-600', 'border-indigo-500');
    adminTabs[tabName].classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'border-transparent');

    // Gestione visualizzazione contenuto
    Object.values(adminContents).forEach(content => content.classList.add('hidden'));
    adminContents[tabName].classList.remove('hidden');
}


async function loadAdminData() {
    // Carica e renderizza studenti
    const { data: students, error: studentsError } = await sbClient.from('profiles').select('id, nome, email').eq('ruolo', 'student');
    if(studentsError) console.error("Errore caricamento studenti:", studentsError);
    else renderTable(tableBodies.students, students, ['nome', 'email']);

    // Carica e renderizza insegnanti
    const { data: teachers, error: teachersError } = await sbClient.from('profiles').select('id, nome, email').eq('ruolo', 'teacher');
    if(teachersError) console.error("Errore caricamento insegnanti:", teachersError);
    else renderTable(tableBodies.teachers, teachers, ['nome', 'email']);

    // Carica e renderizza aule
    const { data: classrooms, error: classroomsError } = await sbClient.from('aule').select('id, nome');
    if(classroomsError) console.error("Errore caricamento aule:", classroomsError);
    else renderTable(tableBodies.classrooms, classrooms, ['nome']);
}

function renderTable(tbody, data, columns) {
    tbody.innerHTML = ''; // Pulisci la tabella
    if (data.length === 0) {
        const row = `<tr><td colspan="${columns.length}" class="px-6 py-4 text-center text-gray-500">Nessun dato disponibile.</td></tr>`;
        tbody.innerHTML = row;
        return;
    }
    data.forEach(item => {
        const row = document.createElement('tr');
        columns.forEach(col => {
            const cell = document.createElement('td');
            cell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-800';
            cell.textContent = item[col] || '-';
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
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

