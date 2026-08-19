export type Ruolo = 'admin' | 'teacher' | 'student';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nome: string;
          email: string;
          ruolo: Ruolo;
          aula_default_id: string | null;
        };
        Insert: {
          id: string;
          nome: string;
          email: string;
          ruolo: Ruolo;
          aula_default_id?: string | null;
        };
        Update: {
          nome?: string;
          aula_default_id?: string | null;
        };
      };
      aule: {
        Row: { id: string; nome: string };
        Insert: { nome: string };
        Update: { nome?: string };
      };
      appuntamenti: {
        Row: {
          id: string;
          studente_id: string;
          insegnante_id: string;
          aula_id: string;
          data_inizio: string;
          data_fine: string;
          note: string | null;
        };
        Insert: {
          studente_id: string;
          insegnante_id: string;
          aula_id: string;
          data_inizio: string;
          data_fine: string;
          note?: string | null;
        };
        Update: {
          studente_id?: string;
          insegnante_id?: string;
          aula_id?: string;
          data_inizio?: string;
          data_fine?: string;
          note?: string | null;
        };
      };
    };
    Functions: {
      get_all_user_profiles: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          nome: string;
          email: string;
          ruolo: Ruolo;
          aula_default_id: string | null;
          aula_default_nome: string | null;
        }[];
      };
      get_occupied_slots: {
        Args: { p_start?: string; p_end?: string };
        Returns: {
          data_inizio: string;
          data_fine: string;
          insegnante_id: string;
          aula_nome: string | null;
        }[];
      };
    };
  };
}
