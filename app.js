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

// --- GESTIONE LOGIN / LOGOUT ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = event.target.email.value;
    const password = event.target.password.value;
    loginError.textContent = ''; // Pulisce errori precedenti

    const { data, error } = await sbClient.auth.signInWithPassword({ email, password });

    if (error) {
        loginError.textContent = 'Credenziali non valide. Riprova.';
        console.error('Login error:', error.message);
    } else if (data.user) {
        // Login riuscito, ora mostriamo l'app
        await loadUserDataAndRenderUI(data.user);
    }
});

logoutButton.addEventListener('click', async () => {
    await sbClient.auth.signOut();
    showLoginScreen();
});

// --- FUNZIONI DI VISUALIZZAZIONE ---
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

// --- LOGICA PRINCIPALE ---
// Funzione per caricare i dati dell'utente (es. il ruolo) e aggiornare l'UI
async function loadUserDataAndRenderUI(user) {
    showAppScreen(user);

    // 1. Recupera il profilo e il ruolo dell'utente
    const { data: profile, error } = await sbClient
        .from('profiles')
        .select('ruolo')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error("Errore nel caricare il profilo utente:", error);
        loginError.textContent = "Impossibile caricare il profilo utente.";
        await sbClient.auth.signOut();
        showLoginScreen();
        return;
    }
    
    // 2. Aggiungi il link "Amministrazione" per gli admin
    // Pulisce il link admin se esisteva da un login precedente
    const existingAdminLink = document.getElementById('admin-link');
    if (existingAdminLink) existingAdminLink.remove();

    if (profile.ruolo === 'admin') {
        const adminLink = document.createElement('a');
        adminLink.href = '#';
        adminLink.id = 'admin-link';
        adminLink.className = 'block px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md';
        adminLink.textContent = 'Amministrazione';
        appNavigation.appendChild(adminLink);
    }

    // 3. (Futuro) Qui caricheremo i dati del calendario e delle tabelle
    console.log(`Utente loggato con ruolo: ${profile.ruolo}`);
    // initializeCalendar(profile.ruolo);
}

// Controlla se l'utente è già loggato al caricamento della pagina
async function checkUserSession() {
    const { data: { session } } = await sbClient.auth.getSession();
    if (session) {
        await loadUserDataAndRenderUI(session.user);
    } else {
        showLoginScreen();
    }
}

// Avvia l'applicazione
checkUserSession();


