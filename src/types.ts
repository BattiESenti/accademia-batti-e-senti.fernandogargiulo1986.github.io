import type { Ruolo } from './lib/database.types';

export type { Ruolo };

export interface Profile {
  id: string;
  nome: string;
  ruolo: Ruolo;
  aula_default_id: string | null;
}

// Restituito solo dalla RPC get_all_user_profiles (admin), che unisce
// profiles con l'email da auth.users. La tabella profiles non ha una
// colonna email: per l'utente corrente si usa auth user.email.
export interface AdminProfile extends Profile {
  email: string;
  aula_default_nome: string | null;
}

export interface Aula {
  id: string;
  nome: string;
}

export interface AppuntamentoRelations {
  id: string;
  data_inizio: string;
  data_fine: string;
  note: string | null;
  studente_id: { id: string; nome: string } | null;
  insegnante_id: { id: string; nome: string } | null;
  aula_id: { id: string; nome: string } | null;
}

export interface OccupiedSlot {
  data_inizio: string;
  data_fine: string;
  insegnante_id: string;
  aula_nome: string | null;
}
