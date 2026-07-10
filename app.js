import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx";

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
const summaryView = document.getElementById('summary-view');

// Riepilogo lezioni
const summaryFrom = document.getElementById('summary-from');
const summaryTo = document.getElementById('summary-to');
const summaryGenerateBtn = document.getElementById('summary-generate-btn');
const summaryDownloadBtn = document.getElementById('summary-download-btn');
const summaryResult = document.getElementById('summary-result');

// Dati dell'ultimo riepilogo generato (usati per l'export Excel)
let lastSummaryData = null;

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

// Bottone nuovo appuntamento e input datetime
const newAppointmentBtn = document.getElementById('new-appointment-btn');
const appointmentDatetimeInputs = document.getElementById('appointment-datetime-inputs');
const appointmentDate = document.getElementById('appointment-date');
const appointmentStartTime = document.getElementById('appointment-start-time');
const appointmentEndTime = document.getElementById('appointment-end-time');

// Ricorrenza
const recurringContainer = document.getElementById('recurring-container');
const recurringToggle = document.getElementById('recurring-toggle');
const recurringToggleKnob = document.getElementById('recurring-toggle-knob');
const recurringEndDateContainer = document.getElementById('recurring-end-date-container');
const recurringEndDate = document.getElementById('recurring-end-date');

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
    ['nav-admin', 'nav-summary'].forEach(id => document.getElementById(id)?.remove());
    if (role === 'admin') {
        const adminLink = document.createElement('a');
        adminLink.href = '#';
        adminLink.id = 'nav-admin';
        adminLink.className = 'nav-link block px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md';
        adminLink.textContent = 'Amministrazione';
        appNavigation.appendChild(adminLink);

        const summaryLink = document.createElement('a');
        summaryLink.href = '#';
        summaryLink.id = 'nav-summary';
        summaryLink.className = 'nav-link block px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md';
        summaryLink.textContent = 'Riepilogo Lezioni';
        appNavigation.appendChild(summaryLink);
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
    [calendarView, adminView, notesView, summaryView].forEach(v => v.classList.add('hidden'));
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
    } else if (viewName === 'summary') {
        summaryView.classList.remove('hidden');
        activeLink = document.getElementById('nav-summary');
    }
    if (activeLink) activeLink.classList.add('active', 'font-bold');
}

function setupEventListeners() {
    document.getElementById('nav-calendar').addEventListener('click', (e) => { e.preventDefault(); showView('calendar'); });
    document.getElementById('nav-notes').addEventListener('click', (e) => { e.preventDefault(); showView('notes'); });
    document.getElementById('nav-admin')?.addEventListener('click', (e) => { e.preventDefault(); showView('admin'); });
    document.getElementById('nav-summary')?.addEventListener('click', (e) => { e.preventDefault(); showView('summary'); });
    summaryGenerateBtn.addEventListener('click', generateSummary);
    summaryDownloadBtn.addEventListener('click', downloadSummaryExcel);
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

    newAppointmentBtn.addEventListener('click', () => openModalForNew());

    window.addEventListener('resize', () => {
        if (calendar) {
            initializeCalendar();
        }
    });
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
    const { data: profiles, error: profilesError } = await sbClient.rpc('get_all_user_profiles');

    if (profilesError) {
        console.error("Errore caricamento profili:", profilesError);
        renderTable('students', null, ['nome', 'email']);
        renderTable('teachers', null, ['nome', 'email', 'aula_default_nome']);
        return;
    }

    const students = profiles.filter(p => p.ruolo === 'student');
    const teachers = profiles.filter(p => p.ruolo === 'teacher');

    renderTable('students', students, ['nome', 'email']);
    renderTable('teachers', teachers, ['nome', 'email', 'aula_default_nome']);

    const { data: classrooms, error: cError } = await sbClient.from('aule').select('id, nome');
    if (cError) console.error("Errore caricamento aule:", cError);
    else renderTable('classrooms', classrooms, ['nome']);
}

function renderTable(type, data, columns) {
    const tbody = tableBodies[type];
    tbody.innerHTML = '';

    if (!data) {
        const colspan = columns.length + 1;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="px-6 py-4 text-center text-red-500">Errore nel caricamento dei dati. Controlla la console.</td></tr>`;
        return;
    }

    if (data.length === 0) {
        const colspan = columns.length + 1;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="px-6 py-4 text-center text-gray-500">Nessun dato disponibile.</td></tr>`;
        return;
    }

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
        let itemData;
        if (type === 'classrooms') {
            const { data } = await sbClient.from('aule').select('*').eq('id', id).single();
            itemData = data;
        } else {
            const { data: profiles } = await sbClient.rpc('get_all_user_profiles');
            itemData = profiles?.find(p => p.id === id);
        }
        if (itemData) openAdminModal(type, itemData);

    } else if (target.classList.contains('admin-delete-btn')) {
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
    adminDefaultClassroomContainer.classList.toggle('hidden', !(type === 'teachers'));

    adminInputEmail.required = isProfile && isCreating;
    adminInputPassword.required = isProfile && isCreating;

    if (item) { // Edit mode
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
    } else { // Create mode
        if (isProfile) {
             adminInputEmail.readOnly = false;
        }
        if (type === 'teachers') {
            const { data: aule } = await sbClient.from('aule').select('id, nome');
            adminDefaultClassroomSelect.innerHTML = '<option value="">Nessuna</option>';
            aule.forEach(a => {
                const option = document.createElement('option');
                option.value = a.id;
                option.textContent = a.nome;
                adminDefaultClassroomSelect.appendChild(option);
            });
        }
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
            const newRole = type === 'students' ? 'student' : 'teacher';
            const defaultClassroom = (type === 'teachers') ? adminDefaultClassroomSelect.value || null : null;

            const { error: signUpError } = await sbClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nome: name,
                        ruolo: newRole,
                        aula_default_id: defaultClassroom
                    }
                }
            });

            if(signUpError) {
                error = signUpError;
            }

            if (adminSession) {
                await sbClient.auth.setSession(adminSession);
            }
        }
    }

    if (error) {
        adminFormError.textContent = `Errore: ${error.message}`;
    } else {
        closeAdminModal();
        loadAdminData();
    }
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

async function fetchEvents(info) {
    let query = sbClient.from('appuntamenti').select('*, studente_id(id, nome), insegnante_id(id, nome), aula_id(id, nome)');

    if (info && info.startStr && info.endStr) {
        query = query.gte('data_inizio', info.startStr).lte('data_inizio', info.endStr);
    }

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

    if (currentUserRole === 'teacher' || currentUserRole === 'admin') {
        const rpcParams = (info && info.startStr && info.endStr)
            ? { p_start: info.startStr, p_end: info.endStr }
            : {};
        const { data: occupied, error: rpcError } = await sbClient.rpc('get_occupied_slots', rpcParams);
        if (occupied && !rpcError) {
            const otherTeachersSlots = occupied.filter(s => s.insegnante_id !== currentUser.id);
             otherTeachersSlots.forEach(slot => {
                const event = {
                    title: `Occupato (${slot.aula_nome})`,
                    start: slot.data_inizio,
                    end: slot.data_fine,
                    display: 'block',
                    backgroundColor: getEventColor(slot.aula_nome),
                    borderColor: getEventColor(slot.aula_nome),
                    editable: false,
                    extendedProps: { isOccupied: true }
                };
                allEvents.push(event);
            });
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
        initialView: isMobile ? 'timeGridDay' : 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: isMobile ? 'timeGridDay,listWeek' : 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        locale: 'it', slotMinTime: '08:00:00', slotMaxTime: '21:00:00', allDaySlot: false,
        editable: isEditable,
        events: (info, success, fail) => fetchEvents(info).then(success).catch(fail),
        eventClick: (info) => {
            if (info.event.extendedProps.isOccupied) return;
            if (info.event.display !== 'background') openModalForEdit(info.event);
        }
    });
    calendar.render();

    newAppointmentBtn.classList.toggle('hidden', !isEditable);
}

// --- LOGICA TOGGLE RICORRENZA ---

recurringToggle.addEventListener('click', () => {
    const isOn = recurringToggle.getAttribute('aria-checked') === 'true';
    const nowOn = !isOn;
    recurringToggle.setAttribute('aria-checked', String(nowOn));
    recurringToggle.classList.toggle('bg-indigo-600', nowOn);
    recurringToggle.classList.toggle('bg-gray-200', !nowOn);
    recurringToggleKnob.classList.toggle('translate-x-6', nowOn);
    recurringToggleKnob.classList.toggle('translate-x-1', !nowOn);
    recurringEndDateContainer.classList.toggle('hidden', !nowOn);
});

function resetRecurringToggle() {
    recurringToggle.setAttribute('aria-checked', 'false');
    recurringToggle.classList.remove('bg-indigo-600');
    recurringToggle.classList.add('bg-gray-200');
    recurringToggleKnob.classList.remove('translate-x-6');
    recurringToggleKnob.classList.add('translate-x-1');
    recurringEndDateContainer.classList.add('hidden');
    recurringEndDate.value = '';
}

// --- LOGICA MODALE APPUNTAMENTI ---

async function openModalForNew() {
    appointmentForm.reset();
    modalTitle.textContent = 'Nuovo Appuntamento';
    appointmentIdInput.value = '';
    deleteButton.style.display = 'none';
    appointmentNotes.readOnly = false;
    document.querySelector('#appointment-form button[type="submit"]').style.display = '';

    [studentSelect, teacherSelect, classroomSelect].forEach(el => { el.style.display = 'block'; });
    [appointmentStudentName, appointmentTeacherName].forEach(el => { el.style.display = 'none'; });

    appointmentTime.style.display = 'none';
    appointmentDatetimeInputs.classList.remove('hidden');
    appointmentDate.value = new Date().toISOString().slice(0, 10);
    appointmentStartTime.value = '';
    appointmentEndTime.value = '';

    recurringContainer.style.display = '';
    resetRecurringToggle();

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
    appointmentTime.style.display = '';
    appointmentTime.textContent = `${start.toLocaleDateString('it-IT')} ${start.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}`;
    appointmentDatetimeInputs.classList.add('hidden');
    appointmentNotes.value = extendedProps.note || '';
    appointmentNotes.readOnly = !canEdit;

    // La ricorrenza non è disponibile in modalità modifica
    recurringContainer.style.display = 'none';

    if (canEdit) {
        [studentSelect, teacherSelect, classroomSelect].forEach(el => { el.style.display = 'block'; });
        [appointmentStudentName, appointmentTeacherName].forEach(el => { el.style.display = 'none'; });
        await populateAppointmentSelects(extendedProps.studente_id?.id, extendedProps.aula_id?.id, extendedProps.insegnante_id?.id);
        teacherSelect.disabled = currentUserRole === 'teacher';
    } else {
        [studentSelect, teacherSelect, classroomSelect].forEach(el => { el.style.display = 'none'; });
        [appointmentStudentName, appointmentTeacherName].forEach(el => { el.style.display = 'block'; });
        appointmentStudentName.textContent = `Studente: ${extendedProps.studente_id?.nome || 'N/D'}`;
        appointmentTeacherName.textContent = `Insegnante: ${extendedProps.insegnante_id?.nome || 'N/D'}`;
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
        const dateVal = appointmentDate.value;
        const startVal = appointmentStartTime.value;
        const endVal = appointmentEndTime.value;

        if (!dateVal || !startVal || !endVal) {
            alert("Inserisci data, ora di inizio e ora di fine.");
            return;
        }
        if (endVal <= startVal) {
            alert("L'orario di fine deve essere successivo all'inizio.");
            return;
        }

        const startISO = new Date(`${dateVal}T${startVal}`).toISOString();
        const endISO = new Date(`${dateVal}T${endVal}`).toISOString();

        const isRecurring = recurringToggle.getAttribute('aria-checked') === 'true';

        if (isRecurring && recurringEndDate.value) {
            const endLimit = new Date(recurringEndDate.value + 'T23:59:59');
            let startDate = new Date(startISO);
            let endDate = new Date(endISO);
            const weekMs = 7 * 24 * 60 * 60 * 1000;
            const appointments = [];

            while (startDate <= endLimit) {
                appointments.push({
                    ...appointmentData,
                    data_inizio: startDate.toISOString(),
                    data_fine: endDate.toISOString(),
                });
                startDate = new Date(startDate.getTime() + weekMs);
                endDate = new Date(endDate.getTime() + weekMs);
            }
            ({ error } = await sbClient.from('appuntamenti').insert(appointments));
        } else {
            appointmentData.data_inizio = startISO;
            appointmentData.data_fine = endISO;
            ({ error } = await sbClient.from('appuntamenti').insert(appointmentData));
        }
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

// --- RIEPILOGO LEZIONI ---

async function generateSummary() {
    const from = summaryFrom.value;
    const to = summaryTo.value;

    if (!from || !to) {
        alert('Seleziona un intervallo di date.');
        return;
    }
    if (to < from) {
        alert('La data di fine deve essere successiva alla data di inizio.');
        return;
    }

    summaryResult.innerHTML = '<p class="text-gray-500 text-sm">Caricamento...</p>';

    const { data, error } = await sbClient
        .from('appuntamenti')
        .select('data_inizio, studente_id(id, nome)')
        .gte('data_inizio', from + 'T00:00:00')
        .lte('data_inizio', to + 'T23:59:59')
        .order('data_inizio', { ascending: true });

    if (error) {
        summaryResult.innerHTML = `<p class="text-red-500 text-sm">Errore: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        summaryResult.innerHTML = '<p class="text-gray-500 text-sm">Nessuna lezione trovata nell\'intervallo selezionato.</p>';
        lastSummaryData = null;
        summaryDownloadBtn.classList.add('hidden');
        return;
    }

    // Costruisce l'elenco dei mesi nell'intervallo
    const months = [];
    const cursor = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    cursor.setDate(1);
    end.setDate(1);
    while (cursor <= end) {
        months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }

    // Aggrega: studente → mese → conteggio
    const students = new Map();
    data.forEach(apt => {
        const student = apt.studente_id;
        if (!student) return;
        if (!students.has(student.id)) students.set(student.id, { nome: student.nome, counts: {} });
        const monthKey = apt.data_inizio.slice(0, 7);
        const s = students.get(student.id);
        s.counts[monthKey] = (s.counts[monthKey] || 0) + 1;
    });

    const monthLabel = key => {
        const [year, month] = key.split('-');
        return new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
    };

    // Render tabella
    const sorted = [...students.values()].sort((a, b) => a.nome.localeCompare(b.nome));
    let html = `<table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50"><tr>
            <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Studente</th>
            ${months.map(m => `<th class="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">${monthLabel(m)}</th>`).join('')}
            <th class="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">Totale</th>
        </tr></thead>
        <tbody class="bg-white divide-y divide-gray-200">`;

    sorted.forEach(s => {
        const total = Object.values(s.counts).reduce((a, b) => a + b, 0);
        html += `<tr>
            <td class="px-4 py-3 font-medium text-gray-900">${s.nome}</td>
            ${months.map(m => `<td class="px-4 py-3 text-center text-gray-700">${s.counts[m] || 0}</td>`).join('')}
            <td class="px-4 py-3 text-center font-bold text-indigo-700">${total}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    summaryResult.innerHTML = html;

    lastSummaryData = { months, sorted, monthLabel, from, to };
    summaryDownloadBtn.classList.remove('hidden');
}

function downloadSummaryExcel() {
    if (!lastSummaryData) return;
    const { months, sorted, monthLabel, from, to } = lastSummaryData;

    const header = ['Studente', ...months.map(monthLabel), 'Totale'];
    const rows = sorted.map(s => {
        const total = Object.values(s.counts).reduce((a, b) => a + b, 0);
        return [s.nome, ...months.map(m => s.counts[m] || 0), total];
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riepilogo Lezioni');
    XLSX.writeFile(wb, `riepilogo_lezioni_${from}_${to}.xlsx`);
}

// --- INIZIALIZZAZIONE ---
checkUserSession();
