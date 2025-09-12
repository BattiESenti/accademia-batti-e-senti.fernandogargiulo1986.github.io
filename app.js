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

// Modale Appuntamenti
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

// Modale Admin
const adminModal = document.getElementById('admin-modal');
const adminModalTitle = document.getElementById('admin-modal-title');
const adminForm = document.getElementById('admin-form');
const adminEditId = document.getElementById('admin-edit-id');
const adminEditType = document.getElementById('admin-edit-type');
const adminInputName = document.getElementById('admin-input-name');
const adminInputEmailContainer = document.getElementById('admin-input-email-container');
const adminInputEmail = document.getElementById('admin-input-email');
const adminInputPasswordContainer = document.getElementById('admin-input-password-container');
const adminInputPassword = document.getElementById('admin-input-password');
const adminCancelButton = document.getElementById('admin-cancel-button');
const adminSaveButton = document.getElementById('admin-save-button');

// Elementi Admin
const addStudentBtn = document.getElementById('add-student-btn');
const addTeacherBtn = document.getElementById('add-teacher-btn');
const addClassroomBtn = document.getElementById('add-classroom-btn');
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
    showView('calendar');
    console.log(`Utente loggato con ruolo: ${profile.ruolo}`);
}

function updateNavigation(role) {
    const existingAdminLink = document.getElementById('nav-admin');
    if (existingAdminLink) existingAdminLink.remove();

    if (role === 'admin') {
        const adminLink = document.createElement('a');
        adminLink.href = '#';
        adminLink.id = 'nav-admin';
        adminLink.className = 'nav-link block px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md';
        adminLink.textContent = 'Amministrazione';
        appNavigation.appendChild(adminLink);
    }
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
    calendarView.classList.add('hidden');
    adminView.classList.add('hidden');
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    if (viewName === 'calendar') {
        calendarView.classList.remove('hidden');
        document.getElementById('nav-calendar').classList.add('active');
    } else if (viewName === 'admin') {
        adminView.classList.remove('hidden');
        const adminLink = document.getElementById('nav-admin');
        if (adminLink) adminLink.classList.add('active');
        loadAdminData();
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

    Object.keys(adminTabs).forEach(key => {
        adminTabs[key].addEventListener('click', () => showAdminTab(key));
    });

    Object.values(tableBodies).forEach(tbody => {
        tbody.addEventListener('click', handleAdminTableClick);
    });
    
    addStudentBtn.addEventListener('click', () => openAdminModal('students'));
    addTeacherBtn.addEventListener('click', () => openAdminModal('teachers'));
    addClassroomBtn.addEventListener('click', () => openAdminModal('classrooms'));
    adminForm.addEventListener('submit', handleAdminFormSubmit);
    adminCancelButton.addEventListener('click', closeAdminModal);
}

// --- LOGICA PANNELLO DI AMMINISTRAZIONE ---

function showAdminTab(tabName) {
    Object.values(adminTabs).forEach(tab => {
        tab.classList.remove('text-indigo-600', 'border-indigo-500');
        tab.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'border-transparent');
    });
    adminTabs[tabName].classList.add('text-indigo-600', 'border-indigo-500');
    adminTabs[tabName].classList.remove('text-gray-500');

    Object.values(adminContents).forEach(content => content.classList.add('hidden'));
    adminContents[tabName].classList.remove('hidden');
}

async function loadAdminData() {
    const { data: students, error: sError } = await sbClient.from('profiles').select('id, nome, email').eq('ruolo', 'student');
    if(sError) console.error("Errore caricamento studenti:", sError); else renderTable('students', students, ['nome', 'email']);

    const { data: teachers, error: tError } = await sbClient.from('profiles').select('id, nome, email').eq('ruolo', 'teacher');
    if(tError) console.error("Errore caricamento insegnanti:", tError); else renderTable('teachers', teachers, ['nome', 'email']);

    const { data: classrooms, error: cError } = await sbClient.from('aule').select('id, nome');
    if(cError) console.error("Errore caricamento aule:", cError); else renderTable('classrooms', classrooms, ['nome']);
}

function renderTable(type, data, columns) {
    const tbody = tableBodies[type];
    tbody.innerHTML = '';
    if (data.length === 0) {
        const colspan = columns.length + 1;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="px-6 py-4 text-center text-gray-500">Nessun dato disponibile.</td></tr>`;
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
        const actionsCell = document.createElement('td');
        actionsCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2';
        actionsCell.innerHTML = `
            <button class="text-indigo-600 hover:text-indigo-900 admin-edit-btn" data-id="${item.id}" data-type="${type}" data-name="${item.nome || ''}" data-email="${item.email || ''}">Modifica</button>
            <button class="text-red-600 hover:text-red-900 admin-delete-btn" data-id="${item.id}" data-type="${type}" data-name="${item.nome || item.email}">Elimina</button>
        `;
        row.appendChild(actionsCell);
        tbody.appendChild(row);
    });
}

function handleAdminTableClick(event) {
    const target = event.target;
    if (target.classList.contains('admin-edit-btn')) {
        const { id, type, name, email } = target.dataset;
        openAdminModal(type, { id, nome: name, email });
    }
    if (target.classList.contains('admin-delete-btn')) {
        const { id, type, name } = target.dataset;
        handleAdminDelete(id, type, name);
    }
}

async function handleAdminDelete(id, type, name) {
    const confirmMessage = `Sei sicuro di voler eliminare "${name}"? Questa azione è irreversibile.`;
    if (!window.confirm(confirmMessage)) return;

    let error;
    if (type === 'students' || type === 'teachers') {
        const { error: deleteError } = await sbClient.from('profiles').delete().eq('id', id);
        error = deleteError;
        // Per una pulizia completa, l'utente dovrebbe essere eliminato anche dalla sezione Authentication.
    } else if (type === 'classrooms') {
        const { error: deleteError } = await sbClient.from('aule').delete().eq('id', id);
        error = deleteError;
    }

    if (error) {
        alert(`Errore durante l'eliminazione: ${error.message}`);
    } else {
        loadAdminData();
    }
}

function openAdminModal(type, item = null) {
    adminForm.reset();
    adminEditId.value = item ? item.id : '';
    adminEditType.value = type;

    if (type === 'students' || type === 'teachers') {
        adminInputEmailContainer.classList.remove('hidden');
        if (item) { // Edit mode
            adminModalTitle.textContent = `Modifica ${type === 'students' ? 'Studente' : 'Insegnante'}`;
            adminInputName.value = item.nome;
            adminInputEmail.value = item.email;
            adminInputEmail.readOnly = true;
            adminInputEmail.classList.add('bg-gray-100');
            adminInputPasswordContainer.classList.add('hidden');
            adminInputPassword.required = false;
        } else { // Create mode
            adminModalTitle.textContent = `Nuovo ${type === 'students' ? 'Studente' : 'Insegnante'}`;
            adminInputEmail.readOnly = false;
            adminInputEmail.classList.remove('bg-gray-100');
            adminInputPasswordContainer.classList.remove('hidden');
            adminInputPassword.required = true;
        }
    } else if (type === 'classrooms') {
        adminModalTitle.textContent = item ? 'Modifica Aula' : 'Nuova Aula';
        adminInputName.value = item ? item.nome : '';
        adminInputEmailContainer.classList.add('hidden');
        adminInputPasswordContainer.classList.add('hidden');
        adminInputPassword.required = false;
    }
    
    adminModal.classList.remove('hidden');
    adminModal.classList.add('flex');
}

function closeAdminModal() {
    adminModal.classList.add('hidden');
    adminModal.classList.remove('flex');
}

async function handleAdminFormSubmit(event) {
    event.preventDefault();
    const id = adminEditId.value;
    const type = adminEditType.value;
    const name = adminInputName.value;
    let error;

    if (id) { // --- EDIT MODE ---
        if (type === 'students' || type === 'teachers') {
            ({ error } = await sbClient.from('profiles').update({ nome: name }).eq('id', id));
        } else if (type === 'classrooms') {
            ({ error } = await sbClient.from('aule').update({ nome: name }).eq('id', id));
        }
    } else { // --- CREATE MODE ---
        if (type === 'students' || type === 'teachers') {
            const email = adminInputEmail.value.trim();
            const password = adminInputPassword.value;
            
            // 1. Salva la sessione corrente dell'admin
            const { data: { session: adminSession }, error: sessionError } = await sbClient.auth.getSession();
             if (sessionError || !adminSession) {
                alert('Errore di sessione, impossibile creare utente. Riprovare il login.');
                return;
            }

            // 2. Crea il nuovo utente (questo fa il logout dell'admin temporaneamente)
            const { data: { user: newUser }, error: signUpError } = await sbClient.auth.signUp({ email, password });

            if (signUpError) {
                error = signUpError;
            } else if (newUser) {
                // 3. Aggiorna il profilo del nuovo utente con nome e ruolo corretto
                const newRole = type === 'students' ? 'student' : 'teacher';
                const { error: updateError } = await sbClient.from('profiles')
                    .update({ nome: name, ruolo: newRole })
                    .eq('id', newUser.id);

                if (updateError) {
                    error = { message: `Utente creato, ma errore nell'aggiornare il profilo: ${updateError.message}` };
                } else {
                    // 4. Ripristina la sessione dell'admin
                    const { error: restoreError } = await sbClient.auth.setSession(adminSession);
                    if(restoreError) {
                        alert('Nuovo utente creato, ma si è verificato un errore nel ripristino della sessione. Si prega di effettuare nuovamente il login.');
                        await sbClient.auth.signOut();
                        showLoginScreen();
                    }
                }
            }
        } else if (type === 'classrooms') {
            ({ error } = await sbClient.from('aule').insert({ nome: name }));
        }
    }

    if (error) {
        alert(`Errore nel salvataggio: ${error.message}`);
    } else {
        closeAdminModal();
        loadAdminData();
    }
}


// --- LOGICA DEL CALENDARIO ---

async function fetchEvents(user, role) {
    let allEvents = [];
    const selectString = '*, studente_id(id, nome), insegnante_id(id, nome), aula_id(id, nome)';

    let query = (role === 'admin') ? sbClient.from('appuntamenti').select(selectString)
              : (role === 'student') ? sbClient.from('appuntamenti').select(selectString).eq('studente_id', user.id)
              : sbClient.from('appuntamenti').select(selectString).eq('insegnante_id', user.id);
    
    const { data, error } = await query;
    if (error) { console.error("Errore nel caricare gli appuntamenti:", error); return []; }

    allEvents.push(...data.map(apt => ({
        id: apt.id,
        title: `${apt.studente_id?.nome || '?'} con ${apt.insegnante_id?.nome || '?'}`,
        start: apt.data_inizio, end: apt.data_fine,
        extendedProps: {
            notes: apt.note,
            studentId: apt.studente_id?.id, teacherId: apt.insegnante_id?.id, classroomId: apt.aula_id?.id
        }
    })));

    if (role === 'teacher') {
        const { data: occupied, error: rpcError } = await sbClient.rpc('get_occupied_slots');
        if (rpcError) { console.error("Errore slot occupati:", rpcError); }
        else {
            allEvents.push(...occupied.filter(s => s.insegnante_id !== user.id).map(s => ({
                title: 'Occupato', start: s.data_inizio, end: s.data_fine, display: 'background', color: '#e5e7eb'
            })));
        }
    }
    return allEvents;
}

function initializeCalendar(user, role) {
    const calendarEl = document.getElementById('calendar');
    if (calendar) calendar.destroy();
    const isEditable = role === 'admin' || role === 'teacher';

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
        locale: 'it', slotMinTime: '08:00:00', slotMaxTime: '21:00:00', allDaySlot: false,
        selectable: isEditable, editable: isEditable,
        events: (info, success, fail) => fetchEvents(user, role).then(success).catch(fail),
        select: (info) => { if (isEditable) { newAppointmentInfo = info; openModalForNew(); } },
        eventClick: (info) => { if (info.event.display !== 'background') openModalForEdit(info.event); }
    });
    calendar.render();
}

// --- LOGICA MODALE APPUNTAMENTI ---

async function openModalForNew() {
    appointmentForm.reset();
    modalTitle.textContent = 'Nuovo Appuntamento';
    appointmentIdInput.value = '';
    deleteButton.classList.add('hidden');
    teacherSelectContainer.style.display = (currentUserRole === 'admin') ? '' : 'none';
    teacherSelect.required = (currentUserRole === 'admin');

    const { start, end } = newAppointmentInfo;
    appointmentTime.textContent = `${start.toLocaleDateString('it-IT')} dalle ${start.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})} alle ${end.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}`;
    
    await populateSelects();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function openModalForEdit(event) {
    appointmentForm.reset();
    modalTitle.textContent = 'Dettagli Appuntamento';
    teacherSelectContainer.style.display = (currentUserRole === 'admin') ? '' : 'none';
    teacherSelect.required = (currentUserRole === 'admin');
    
    const canDelete = currentUserRole === 'admin' || (currentUserRole === 'teacher' && event.extendedProps.teacherId === currentUser.id);
    deleteButton.style.display = canDelete ? '' : 'none';

    const { start, end, extendedProps, id } = event;
    appointmentIdInput.value = id;
    appointmentTime.textContent = `${start.toLocaleDateString('it-IT')} dalle ${start.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})} alle ${end.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}`;
    appointmentNotes.value = extendedProps.notes || '';
    
    await populateSelects(extendedProps.studentId, extendedProps.classroomId, extendedProps.teacherId);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function populateSelects(selectedStudentId = null, selectedClassroomId = null, selectedTeacherId = null) {
    const populate = async (element, query, nameCol) => {
        const { data, error } = await query;
        if (error) { console.error(`Errore caricamento ${nameCol}:`, error); return; }
        element.innerHTML = `<option value="">Seleziona...</option>`;
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item[nameCol];
            element.appendChild(option);
        });
    };
    await populate(studentSelect, sbClient.from('profiles').select('id, nome').eq('ruolo', 'student'), 'nome');
    if (currentUserRole === 'admin') {
        await populate(teacherSelect, sbClient.from('profiles').select('id, nome').eq('ruolo', 'teacher'), 'nome');
    }
    await populate(classroomSelect, sbClient.from('aule').select('id, nome'), 'nome');

    studentSelect.value = selectedStudentId || '';
    classroomSelect.value = selectedClassroomId || '';
    if (currentUserRole === 'admin') teacherSelect.value = selectedTeacherId || '';
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

