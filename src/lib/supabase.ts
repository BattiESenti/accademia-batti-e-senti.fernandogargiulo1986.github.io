import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti.');
}

// Nota: non usiamo il generico Database<> di supabase-js perché senza uno schema
// generato via Supabase CLI i vincoli sui tipi di insert/update/rpc risultano troppo
// rigidi. La sicurezza dei tipi è garantita a monte tramite le interfacce in src/types.ts,
// applicate esplicitamente su ogni query e mutazione.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
