import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toLocalDateInputValue } from '../lib/datetime';
import type { AppuntamentoRelations, OccupiedSlot } from '../types';

const APPOINTMENT_SELECT = '*, studente_id(id, nome), insegnante_id(id, nome), aula_id(id, nome)';

export interface DateRange {
  start: string;
  end: string;
}

export function useCalendarAppointments(range: DateRange | null, teacherFilterId: string) {
  const { profile, user } = useAuth();

  return useQuery({
    queryKey: ['appointments', range?.start, range?.end, profile?.ruolo, user?.id, teacherFilterId],
    enabled: !!profile && !!range,
    queryFn: async (): Promise<AppuntamentoRelations[]> => {
      let query = supabase.from('appuntamenti').select(APPOINTMENT_SELECT);

      if (range) {
        query = query.gte('data_inizio', range.start).lte('data_inizio', range.end);
      }

      if (profile!.ruolo === 'admin') {
        if (teacherFilterId && teacherFilterId !== 'all') {
          query = query.eq('insegnante_id', teacherFilterId);
        }
      } else if (profile!.ruolo === 'teacher') {
        query = query.eq('insegnante_id', user!.id);
      } else {
        query = query.eq('studente_id', user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AppuntamentoRelations[];
    },
  });
}

export function useOccupiedSlots(range: DateRange | null) {
  const { profile } = useAuth();
  const canSeeOccupied = profile?.ruolo === 'admin' || profile?.ruolo === 'teacher';

  return useQuery({
    queryKey: ['occupied-slots', range?.start, range?.end, profile?.ruolo],
    enabled: canSeeOccupied && !!range,
    queryFn: async (): Promise<OccupiedSlot[]> => {
      const { data, error } = await supabase.rpc('get_occupied_slots', {
        p_start: range?.start,
        p_end: range?.end,
      });
      if (error) throw error;
      return data;
    },
  });
}

export interface AppointmentFormInput {
  studente_id: string;
  insegnante_id: string;
  aula_id: string;
  note: string;
}

function invalidateAppointments(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['appointments'] });
  queryClient.invalidateQueries({ queryKey: ['occupied-slots'] });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AppointmentFormInput & { data_inizio: string; data_fine: string }) => {
      const { error } = await supabase.from('appuntamenti').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => invalidateAppointments(queryClient),
  });
}

export function useCreateRecurringAppointments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: (AppointmentFormInput & { data_inizio: string; data_fine: string; serie_id: string })[]) => {
      const { error } = await supabase.from('appuntamenti').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => invalidateAppointments(queryClient),
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AppointmentFormInput & { data_inizio: string; data_fine: string } }) => {
      const { error } = await supabase.from('appuntamenti').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAppointments(queryClient),
  });
}

// Sposta/ridimensiona un appuntamento trascinato sul calendario, senza
// toccare studente/insegnante/aula/note.
export function useMoveAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dataInizio, dataFine }: { id: string; dataInizio: string; dataFine: string }) => {
      const { error } = await supabase
        .from('appuntamenti')
        .update({ data_inizio: dataInizio, data_fine: dataFine })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAppointments(queryClient),
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appuntamenti').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAppointments(queryClient),
  });
}

// Modifica/eliminazione dell'intera serie ricorrente (tutte le righe che
// condividono lo stesso serie_id). Non tocca data_inizio/data_fine: ogni
// occorrenza mantiene il proprio orario, si aggiornano solo gli altri campi.
export function useUpdateAppointmentSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serieId, payload }: { serieId: string; payload: AppointmentFormInput }) => {
      const { error } = await supabase.from('appuntamenti').update(payload).eq('serie_id', serieId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAppointments(queryClient),
  });
}

// Modifica l'orario (ora inizio/fine) di tutta la serie, mantenendo la data
// propria di ciascuna occorrenza. Va eseguita riga per riga perche' ogni
// occorrenza ha una data diversa a cui applicare il nuovo orario.
export function useUpdateAppointmentSeriesTime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      serieId,
      payload,
      startTime,
      endTime,
    }: {
      serieId: string;
      payload: AppointmentFormInput;
      startTime: string;
      endTime: string;
    }) => {
      const { data: rows, error: fetchError } = await supabase
        .from('appuntamenti')
        .select('id, data_inizio')
        .eq('serie_id', serieId);
      if (fetchError) throw fetchError;

      const results = await Promise.all(
        (rows ?? []).map((row) => {
          const dateStr = toLocalDateInputValue(new Date(row.data_inizio));
          const data_inizio = new Date(`${dateStr}T${startTime}`).toISOString();
          const data_fine = new Date(`${dateStr}T${endTime}`).toISOString();
          return supabase.from('appuntamenti').update({ ...payload, data_inizio, data_fine }).eq('id', row.id);
        })
      );
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSuccess: () => invalidateAppointments(queryClient),
  });
}

export function useDeleteAppointmentSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (serieId: string) => {
      const { error } = await supabase.from('appuntamenti').delete().eq('serie_id', serieId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAppointments(queryClient),
  });
}
