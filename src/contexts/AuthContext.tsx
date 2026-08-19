import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string): Promise<{ profile: Profile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, ruolo, aula_default_id')
    .eq('id', userId)
    .single();
  if (error) {
    console.error('Errore nel caricare il profilo utente:', error);
    return { profile: null, error: error.message };
  }
  return { profile: data, error: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Evita che il listener onAuthStateChange rifaccia il fetch del profilo
  // subito dopo un signIn manuale, che lo gestisce già in modo sincrono.
  const manualSignInInFlight = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { profile: p } = await loadProfile(session.user.id);
        if (!isMounted) return;
        if (p) {
          setUser(session.user);
          setProfile(p);
        } else {
          await supabase.auth.signOut();
        }
      }
      if (isMounted) setLoading(false);
    }
    init();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (manualSignInInFlight.current) return;

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        return;
      }
      const { profile: p } = await loadProfile(session.user.id);
      if (p) {
        setUser(session.user);
        setProfile(p);
      } else {
        // Sessione valida ma profilo non caricabile: evita uno stato bloccato.
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    manualSignInInFlight.current = true;
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        return { error: 'Credenziali non valide. Riprova.' };
      }
      if (!data.user) {
        return { error: 'Accesso non riuscito. Riprova.' };
      }

      const { profile: p, error: profileError } = await loadProfile(data.user.id);
      if (!p) {
        await supabase.auth.signOut();
        return {
          error: profileError
            ? `Accesso eseguito ma impossibile caricare il profilo (${profileError}). Contatta l'amministratore.`
            : "Accesso eseguito ma il profilo utente non esiste. Contatta l'amministratore.",
        };
      }

      setUser(data.user);
      setProfile(p);
      return { error: null };
    } finally {
      manualSignInInFlight.current = false;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return ctx;
}
