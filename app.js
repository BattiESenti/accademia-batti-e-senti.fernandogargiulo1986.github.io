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
const notesView = document.getElementById('notes-view');

// Filtri
const calendarFilterContainer = document.getElementById('calendar-filter-container');
const calendarTeacherFilter = document.getElementById('calendar-teacher-filter');
const notesFilterContainer = document.getElementById('notes-filter-container');
const notesTeacherFilter = document.getElementById('notes-teacher-filter');
const notesStudentFilter = document.getElementById('notes-student-filter');

// Vista Appuntamenti & Note
const notesTableBody = document.getElementById('notes-table-body');
const notesTableStudentHeader = document.getElementById('notes-table-student-header');
const notesTableTeacherHeader = document.getElementById('notes-table-teacher-header');

// Modale Appuntamenti
const modal = document.getElementById('appointment-modal');
const modalTitle = document.getElementById('modal-title');
const appointmentForm = document.getElementById('appointment-form');
const appointmentIdInput = document.getElementById('appointment-id');
const studentSelect = document.getElementById('student-select');
const teacherSelect = document.getElementById('teacher-select');
const classroomSelect = document.getElementById('classroom-select');
const appointmentTime = document.getElementById('appointment-time');
const appointmentNotes = document.getElementById('appointment-notes');
const appointmentStudentName = document.getElementById('appointment-student-name');
const appointmentTeacherName = document.getElementById('appointment-teacher-name');
const cancelButton = document.getElementById('cancel-modal-button');
const deleteButton = document.getElementById('delete-appointment-button');

// Modale Admin
const adminModal = document.getElementById('admin-modal');
const adminModalTitle = document.getElementById('admin-modal-title');
const adminForm = document.getElementById('admin-form');
const adminFormError = document.getElementById('admin-form-error');
const adminEditId = document.getElementById('admin-edit-id');
const adminEditType = document.getElementById('admin-edit-type');
const adminInputName = document.getElementById('admin-input-name');
const adminInputEmailContainer = document.getElementById('admin-input-email-container');
const adminInputEmail = document.getElementById('admin-input-email');
const adminInputPasswordContainer = document.getElementById('admin-input-password-container');
const adminInputPassword = document.getElementById('admin-input-password');
const adminDefaultClassroomContainer = document.getElementById('admin-default-classroom-container');
const adminDefaultClassroomSelect = document.getElementById('admin-default-classroom-select');
const adminCancelButton = document.getElementById('admin-cancel-button');

// Elementi Admin
const addStudentBtn = document.getElementById('add-student-btn');
const addTeacherBtn = document.getElementById('add-teacher-btn');
const addClassroomBtn = document.getElementById('add-classroom-btn');
const adminTabs = { students: document.getElementById('tab-students'), teachers: document.getElementById('tab-teachers'), classrooms: document.getElementById('tab-classrooms') };
const adminContents = { students: document.getElementById('admin-content-students'), teachers: document.getElementById('admin-content-teachers'), classrooms: document.getElementById('admin-content-classrooms') };
const tableBodies = { students: document.getElementById('students-table-body'), teachers: document.getElementById('teachers-table-body'), classrooms: document.getElementById('classrooms-table-body') };

// --- VARIABILI GLOBALI DI STATO ---
let calendar;
let currentUser = null;
let currentUserRole = null;
let newAppointmentInfo = null;
let allAppointmentsForNotesView = [];

// --- LOGICA DI AUTENTENTICAZIONE E UI ---

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.textContent = '';
    const { data, error } = await sbClient.auth.signInWithPassword({ email: event.target.email.value, password: event.target.password.value });
    if (error) {
        loginError.textContent = 'Credenziali non valide. Riprova.';
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
    window.location.reload();
});

function showLoginScreen() {
    appSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
}

function showAppScreen(user) {
    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    userEmailSpan.textContent = user.email;
}

async function loadUserDataAndRenderUI(user) {
    showAppScreen(user);
    const { data: profile, error } = await sbClient.from('profiles').select('ruolo, aula_default_id').eq('id', user.id).single();
    if (error) {
        console.error("Errore nel caricare il profilo utente:", error);
        await sbClient.auth.signOut();
        showLoginScreen();
        return;
    }
    currentUserRole = profile.ruolo;
    currentUser.profile = profile;
    updateNavigation(profile.ruolo);
    initializeCalendar();
    showView('calendar');
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
    [calendarView, adminView, notesView].forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active', 'font-bold'));

    let activeLink;
    if (viewName === 'calendar') {
        calendarView.classList.remove('hidden');
        activeLink = document.getElementById('nav-calendar');
        if (currentUserRole === 'admin') setupTeacherFilter(calendarTeacherFilter, () => calendar.refetchEvents());
    } else if (viewName === 'notes') {
        notesView.classList.remove('hidden');
        activeLink = document.getElementById('nav-notes');
        loadNotesViewData();
    } else if (viewName === 'admin') {
        adminView.classList.remove('hidden');
        activeLink = document.getElementById('nav-admin');
        loadAdminData();
    }
    if (activeLink) activeLink.classList.add('active', 'font-bold');
}

function setupEventListeners() {
    document.getElementById('nav-calendar').addEventListener('click', (e) => { e.preventDefault(); showView('calendar'); });
    document.getElementById('nav-notes').addEventListener('click', (e) => { e.preventDefault(); showView('notes'); });
    document.getElementById('nav-admin')?.addEventListener('click', (e) => { e.preventDefault(); showView('admin'); });
    Object.keys(adminTabs).forEach(key => adminTabs[key].addEventListener('click', () => showAdminTab(key)));
    Object.values(tableBodies).forEach(tbody => tbody.addEventListener('click', handleAdminTableClick));
    [addStudentBtn, addTeacherBtn, addClassroomBtn].forEach(btn => btn.addEventListener('click', () => {
        const type = btn.id.replace('add-', '').replace('-btn', '') + 's';
        openAdminModal(type);
    }));
    adminForm.addEventListener('submit', handleAdminFormSubmit);
    adminCancelButton.addEventListener('click', closeAdminModal);
    notesStudentFilter.addEventListener('change', () => renderAppointmentsTable(filterAppointments()));
    notesTeacherFilter.addEventListener('change', () => loadNotesViewData());
}

// --- LOGICA VISTA APPUNTAMENTI & NOTE ---

async function loadNotesViewData() {
    const isTeacher = currentUserRole === 'teacher';
    const isAdmin = currentUserRole === 'admin';
    
    notesFilterContainer.style.display = (isTeacher || isAdmin) ? 'flex' : 'none';
    notesTeacherFilter.style.display = isAdmin ? 'inline-block' : 'none';
    document.querySelector('label[for="notes-teacher-filter"]').style.display = isAdmin ? 'inline-block' : 'none';
    
    notesTableStudentHeader.style.display = (isAdmin || isTeacher) ? '' : 'none';
    notesTableTeacherHeader.style.display = (isAdmin || currentUserRole === 'student') ? '' : 'none';

    if (isAdmin) await setupTeacherFilter(notesTeacherFilter);
    
    let query = sbClient.from('appuntamenti').select('*, studente_id(id, nome), insegnante_id(id, nome), aula_id(id, nome)');
    
    if (isAdmin) {
        const selectedTeacherId = notesTeacherFilter.value;
        if (selectedTeacherId && selectedTeacherId !== 'all') query = query.eq('insegnante_id', selectedTeacherId);
    } else if (isTeacher) {
        query = query.eq('insegnante_id', currentUser.id);
    } else { // student
        query = query.eq('studente_id', currentUser.id);
    }

    const { data, error } = await query.order('data_inizio', { ascending: false });
    if (error) { console.error("Errore caricamento note:", error); return; }
    
    allAppointmentsForNotesView = data;
    if(isTeacher || isAdmin) populateStudentFilter(data);
    renderAppointmentsTable(data);
}

function populateStudentFilter(appointments) {
    const students = new Map([['all', 'Tutti gli Studenti']]);
    appointments.forEach(apt => apt.studente_id && students.set(apt.studente_id.id, apt.studente_id.nome));
    notesStudentFilter.innerHTML = '';
    students.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        notesStudentFilter.appendChild(option);
    });
}

function filterAppointments() {
    const selectedStudentId = notesStudentFilter.value;
    return (selectedStudentId === 'all')
        ? allAppointmentsForNotesView
        : allAppointmentsForNotesView.filter(apt => apt.studente_id?.id === selectedStudentId);
}

function renderAppointmentsTable(appointments) {
    notesTableBody.innerHTML = '';
    if (!appointments || appointments.length === 0) {
        notesTableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Nessun appuntamento trovato.</td></tr>`;
        return;
    }
    appointments.forEach(apt => {
        const row = document.createElement('tr');
        const startDate = new Date(apt.data_inizio);
        row.innerHTML = `
            <td class="px-6 py-4">${startDate.toLocaleDateString('it-IT')}</td>
            <td class="px-6 py-4">${startDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</td>
            ${(currentUserRole !== 'student') ? `<td class="px-6 py-4">${apt.studente_id?.nome || 'N/D'}</td>` : ''}
            ${(currentUserRole !== 'teacher') ? `<td class="px-6 py-4">${apt.insegnante_id?.nome || 'N/D'}</td>` : ''}
            <td class="px-6 py-4">${apt.aula_id?.nome || 'N/D'}</td>
            <td class="px-6 py-4 text-sm">${apt.note || ''}</td>
        `;
        notesTableBody.appendChild(row);
    });
}

// --- LOGICA PANNELLO DI AMMINISTRAZIONE ---

function showAdminTab(tabName) {
    const baseClasses = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
    Object.values(adminTabs).forEach(tab => tab.className = `${baseClasses} text-gray-500 hover:text-gray-700 hover:border-gray-300 border-transparent`);
    adminTabs[tabName].className = `${baseClasses} text-indigo-600 border-indigo-500`;
    Object.values(adminContents).forEach(content => content.classList.add('hidden'));
    adminContents[tabName].classList.remove('hidden');
}

async function loadAdminData() {
    const { data: students } = await sbClient.from('profiles').select('id, nome, email').eq('ruolo', 'student');
    renderTable('students', students, ['nome', 'email']);
    const { data: teachers } = await sbClient.from('profiles').select('*, aula_default_id(id, nome)').eq('ruolo', 'teacher');
    renderTable('teachers', teachers, ['nome', 'email', 'aula_default_id.nome']);
    const { data: classrooms } = await sbClient.from('aule').select('id, nome');
    renderTable('classrooms', classrooms, ['nome']);
}

function renderTable(type, data, columns) {
    const tbody = tableBodies[type];
    tbody.innerHTML = '';
    data.forEach(item => {
        const row = document.createElement('tr');
        columns.forEach(col => {
            const cell = document.createElement('td');
            cell.className = 'px-6 py-4 text-sm';
            let value = col.split('.').reduce((o, i) => o?.[i], item);
            cell.textContent = value || '-';
            row.appendChild(cell);
        });
        const actionsCell = document.createElement('td');
        actionsCell.className = 'px-6 py-4 space-x-2 text-right';
        actionsCell.innerHTML = `
            <button class="text-indigo-600 hover:text-indigo-900 admin-edit-btn" data-id="${item.id}" data-type="${type}">Modifica</button>
            <button class="text-red-600 hover:text-red-900 admin-delete-btn" data-id="${item.id}" data-type="${type}" data-name="${item.nome || item.email}">Elimina</button>
        `;
        row.appendChild(actionsCell);
        tbody.appendChild(row);
    });
}

async function handleAdminTableClick(event) {
    const target = event.target;
    if (!target.dataset.id) return;
    const { id, type, name } = target.dataset;

    if (target.classList.contains('admin-edit-btn')) {
        const fromTable = type === 'classrooms' ? 'aule' : 'profiles';
        const { data } = await sbClient.from(fromTable).select('*').eq('id', id).single();
        if (data) openAdminModal(type, data);
    }
    if (target.classList.contains('admin-delete-btn')) {
        handleAdminDelete(id, type, name);
    }
}

async function handleAdminDelete(id, type, name) {
    if (!window.confirm(`Sei sicuro di voler eliminare "${name}"?`)) return;
    const fromTable = type === 'classrooms' ? 'aule' : 'profiles';
    const { error } = await sbClient.from(fromTable).delete().eq('id', id);
    if (error) alert(`Errore: ${error.message}`);
    else loadAdminData();
}

async function openAdminModal(type, item = null) {
    adminForm.reset();
    adminFormError.textContent = '';
    adminEditId.value = item?.id || '';
    adminEditType.value = type;
    adminModalTitle.textContent = `${item ? 'Modifica' : 'Nuovo'} ${type.slice(0, -1)}`;

    const isProfile = type === 'students' || type === 'teachers';
    const isCreating = !item;
    
    adminInputEmailContainer.classList.toggle('hidden', !isProfile);
    adminInputPasswordContainer.classList.toggle('hidden', !(isProfile && isCreating));
    adminDefaultClassroomContainer.classList.toggle('hidden', !(type === 'teachers' && item));
    
    adminInputEmail.required = isProfile && isCreating;
    adminInputPassword.required = isProfile && isCreating;

    if (item) {
        adminInputName.value = item.nome;
        if (isProfile) {
            adminInputEmail.value = item.email;
            adminInputEmail.readOnly = true;
        }
        if (type === 'teachers') {
            const { data: aule } = await sbClient.from('aule').select('id, nome');
            adminDefaultClassroomSelect.innerHTML = '<option value="">Nessuna</option>';
            aule.forEach(a => {
                const option = document.createElement('option');
                option.value = a.id;
                option.textContent = a.nome;
                if (item.aula_default_id === a.id) option.selected = true;
                adminDefaultClassroomSelect.appendChild(option);
            });
        }
    } else {
        if (isProfile) adminInputEmail.readOnly = false;
    }
    adminModal.classList.remove('hidden');
    adminModal.classList.add('flex');
}

function closeAdminModal() {
    adminModal.classList.add('hidden');
    adminModal.classList.remove('flex');
}

async function waitForProfile(userId, retries = 5, delay = 400) {
    for (let i = 0; i < retries; i++) {
        const { data } = await sbClient.from('profiles').select('id').eq('id', userId).single();
        if (data) return data;
        await new Promise(res => setTimeout(res, delay));
    }
    return null;
}

async function handleAdminFormSubmit(event) {
    event.preventDefault();
    adminFormError.textContent = '';
    const id = adminEditId.value;
    const type = adminEditType.value;
    const name = adminInputName.value;
    let error;

    if (id) { // Edit
        const fromTable = type === 'classrooms' ? 'aule' : 'profiles';
        const updateData = { nome: name };
        if (type === 'teachers') {
            updateData.aula_default_id = adminDefaultClassroomSelect.value || null;
        }
        ({ error } = await sbClient.from(fromTable).update(updateData).eq('id', id));
    } else { // Create
        if (type === 'classrooms') {
            ({ error } = await sbClient.from('aule').insert({ nome: name }));
        } else {
            const email = adminInputEmail.value.trim();
            const password = adminInputPassword.value;
            if (password.length < 6) {
                adminFormError.textContent = "La password deve essere di almeno 6 caratteri.";
                return;
            }
            const { data: { session: adminSession } } = await sbClient.auth.getSession();
            const { data: { user: newUser }, error: signUpError } = await sbClient.auth.signUp({ email, password });
            
            if (signUpError) {
                error = signUpError;
            } else if (newUser) {
                const profileExists = await waitForProfile(newUser.id);
                if (!profileExists) {
                    error = { message: "Il profilo utente non è stato creato automaticamente." };
                } else {
                    const newRole = type === 'students' ? 'student' : 'teacher';
                    const { error: updateError } = await sbClient.from('profiles').update({ nome: name, ruolo: newRole }).eq('id', newUser.id);
                    if (updateError) error = { message: `Utente creato, ma errore nell'aggiornare il profilo: ${updateError.message}` };
                }
            }
            if (adminSession) await sbClient.auth.setSession(adminSession);
        }
    }

    if (error) adminFormError.textContent = `Errore: ${error.message}`;
    else { closeAdminModal(); loadAdminData(); }
}

// --- LOGICA DEL CALENDARIO ---

async function setupTeacherFilter(selectElement, onChangeCallback) {
    calendarFilterContainer.style.display = 'block';
    const { data: teachers } = await sbClient.from('profiles').select('id, nome').eq('ruolo', 'teacher');
    selectElement.innerHTML = '<option value="all">Tutti gli Insegnanti</option>';
    teachers.forEach(t => {
        const option = document.createElement('option');
        option.value = t.id;
        option.textContent = t.nome;
        selectElement.appendChild(option);
    });
    if (onChangeCallback) selectElement.onchange = onChangeCallback;
}

function getEventColor(classroomName) {
    if (!classroomName) return '#4f46e5';
    const name = classroomName.toLowerCase();
    const colors = {
        'rossa': '#ef4444', 'rosso': '#ef4444', 'gialla': '#f59e0b', 'giallo': '#f59e0b',
        'verde': '#10b981', 'blu': '#3b82f6', 'azzurra': '#60a5fa', 'azzurro': '#60a5fa',
        'viola': '#8b5cf6', 'arancione': '#f97316'
    };
    return colors[name] || '#6b7280';
}

async function fetchEvents() {
    let query = sbClient.from('appuntamenti').select('*, studente_id(id, nome), insegnante_id(id, nome), aula_id(id, nome)');
    if (currentUserRole === 'admin') {
        const selectedTeacherId = calendarTeacherFilter.value;
        if (selectedTeacherId && selectedTeacherId !== 'all') query = query.eq('insegnante_id', selectedTeacherId);
    } else if (currentUserRole === 'teacher') {
        query = query.eq('insegnante_id', currentUser.id);
    } else {
        query = query.eq('studente_id', currentUser.id);
    }
    const { data, error } = await query;
    if (error) { console.error("Errore fetchEvents:", error); return []; }
    
    let allEvents = data.map(apt => ({
        id: apt.id,
        title: `${apt.studente_id?.nome || '?'} con ${apt.insegnante_id?.nome || '?'}`,
        start: apt.data_inizio, end: apt.data_fine,
        backgroundColor: getEventColor(apt.aula_id?.nome),
        borderColor: getEventColor(apt.aula_id?.nome),
        extendedProps: { ...apt }
    }));

    if (currentUserRole === 'teacher') {
        const { data: occupied, error: rpcError } = await sbClient.rpc('get_occupied_slots');
        if (rpcError) { console.error("Errore RPC:", rpcError); }
        else if (occupied) {
            allEvents.push(...occupied
                .filter(s => s.insegnante_id !== currentUser.id)
                .map(s => ({
                    title: 'Occupato',
                    start: s.data_inizio,
                    end: s.data_fine,
                    display: 'background',
                    backgroundColor: getEventColor(s.aula_nome),
                }))
            );
        }
    }
    return allEvents;
}


function initializeCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (calendar) calendar.destroy();
    
    const isMobile = window.innerWidth < 768;
    const isEditable = currentUserRole === 'admin' || currentUserRole === 'teacher';

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: isMobile ? 'listWeek' : 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: isMobile ? 'listWeek,dayGridMonth' : 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        locale: 'it', slotMinTime: '08:00:00', slotMaxTime: '21:00:00', allDaySlot: false,
        selectable: isEditable, editable: isEditable,
        events: (info, success, fail) => fetchEvents().then(success).catch(fail),
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
    deleteButton.style.display = 'none';
    appointmentNotes.readOnly = false;

    [studentSelect, teacherSelect, classroomSelect].forEach(el => el.style.display = 'block');
    [appointmentStudentName, appointmentTeacherName].forEach(el => el.style.display = 'none');
    
    const { start, end } = newAppointmentInfo;
    appointmentTime.textContent = `${start.toLocaleDateString('it-IT')} ${start.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}`;
    
    await populateAppointmentSelects();
    
    if (currentUserRole === 'teacher') {
        teacherSelect.value = currentUser.id;
        teacherSelect.disabled = true;
        classroomSelect.value = currentUser.profile.aula_default_id || '';
    } else {
        teacherSelect.disabled = false;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function openModalForEdit(event) {
    appointmentForm.reset();
    modalTitle.textContent = 'Dettagli Appuntamento';
    
    const { start, end, extendedProps, id } = event;
    const canEdit = currentUserRole === 'admin' || (currentUserRole === 'teacher' && extendedProps.insegnante_id?.id === currentUser.id);
    
    deleteButton.style.display = canEdit ? '' : 'none';
    document.querySelector('#appointment-form button[type="submit"]').style.display = canEdit ? '' : 'none';
    
    appointmentIdInput.value = id;
    appointmentTime.textContent = `${start.toLocaleDateString('it-IT')} ${start.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}`;
    appointmentNotes.value = extendedProps.note || '';

    if (canEdit) {
        [studentSelect, teacherSelect, classroomSelect].forEach(el => el.style.display = 'block');
        [appointmentStudentName, appointmentTeacherName].forEach(el => el.style.display = 'none');
        await populateAppointmentSelects(extendedProps.studente_id?.id, extendedProps.aula_id?.id, extendedProps.insegnante_id?.id);
        teacherSelect.disabled = currentUserRole === 'teacher';
        appointmentNotes.readOnly = false;
    } else {
        [studentSelect, teacherSelect, classroomSelect].forEach(el => el.style.display = 'none');
        [appointmentStudentName, appointmentTeacherName].forEach(el => el.style.display = 'block');
        appointmentStudentName.textContent = `Studente: ${extendedProps.studente_id?.nome || 'N/D'}`;
        appointmentTeacherName.textContent = `Insegnante: ${extendedProps.insegnante_id?.nome || 'N/D'}`;
        appointmentNotes.readOnly = true;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function populateAppointmentSelects(studentId, classroomId, teacherId) {
    const populate = async (element, query, nameCol, selectedId) => {
        const { data } = await query;
        if(data) {
            element.innerHTML = `<option value="">Seleziona...</option>`;
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item[nameCol];
                if (item.id === selectedId) option.selected = true;
                element.appendChild(option);
            });
        }
    };
    await populate(studentSelect, sbClient.from('profiles').select('id, nome').eq('ruolo', 'student'), 'nome', studentId);
    await populate(teacherSelect, sbClient.from('profiles').select('id, nome').eq('ruolo', 'teacher'), 'nome', teacherId);
    await populate(classroomSelect, sbClient.from('aule').select('id, nome'), 'nome', classroomId);
}

function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    newAppointmentInfo = null;
}

cancelButton.addEventListener('click', closeModal);

appointmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (appointmentNotes.readOnly) { closeModal(); return; }

    const id = appointmentIdInput.value;
    const appointmentData = {
        studente_id: studentSelect.value, aula_id: classroomSelect.value, note: appointmentNotes.value,
        insegnante_id: currentUserRole === 'teacher' ? currentUser.id : teacherSelect.value,
    };

    let error;
    if (id) {
        ({ error } = await sbClient.from('appuntamenti').update(appointmentData).eq('id', id));
    } else {
        appointmentData.data_inizio = newAppointmentInfo.startStr;
        appointmentData.data_fine = newAppointmentInfo.endStr;
        ({ error } = await sbClient.from('appuntamenti').insert(appointmentData));
    }
    if (error) alert("Errore: " + error.message);
    else { closeModal(); calendar.refetchEvents(); }
});

deleteButton.addEventListener('click', async () => {
    const id = appointmentIdInput.value;
    if (id && window.confirm("Sei sicuro di voler eliminare questo appuntamento?")) {
        const { error } = await sbClient.from('appuntamenti').delete().eq('id', id);
        if (error) alert("Errore: " + error.message);
        else { closeModal(); calendar.refetchEvents(); }
    }
});

// --- INIZIALIZZAZIONE ---
checkUserSession();

