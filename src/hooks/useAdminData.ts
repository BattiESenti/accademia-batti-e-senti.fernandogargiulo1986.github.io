import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { sortByNome } from '../lib/sorting';
import type { AdminProfile, Aula, Ruolo } from '../types';

export function useAdminProfiles() {
  return useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async (): Promise<AdminProfile[]> => {
      const { data, error } = await supabase.rpc('get_all_user_profiles');
      if (error) throw error;
      return sortByNome(data as AdminProfile[]);
    },
  });
}

export function useAdminClassrooms() {
  return useQuery({
    queryKey: ['admin-classrooms'],
    queryFn: async (): Promise<Aula[]> => {
      const { data, error } = await supabase.from('aule').select('id, nome');
      if (error) throw error;
      return sortByNome(data);
    },
  });
}

function invalidateAdmin(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
  queryClient.invalidateQueries({ queryKey: ['admin-classrooms'] });
  queryClient.invalidateQueries({ queryKey: ['profiles'] });
  queryClient.invalidateQueries({ queryKey: ['aule'] });
}

export function useSaveClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id?: string; nome: string }) => {
      if (id) {
        const { error } = await supabase.from('aule').update({ nome }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('aule').insert({ nome });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateAdmin(queryClient),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome, aulaDefaultId }: { id: string; nome: string; aulaDefaultId: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ nome, aula_default_id: aulaDefaultId })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAdmin(queryClient),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string; nome: string; ruolo: Ruolo; aulaDefaultId: string | null }) => {
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      const { error: signUpError } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            nome: input.nome,
            ruolo: input.ruolo,
            aula_default_id: input.aulaDefaultId,
          },
        },
      });

      if (adminSession) {
        await supabase.auth.setSession(adminSession);
      }

      if (signUpError) throw signUpError;
    },
    onSuccess: () => invalidateAdmin(queryClient),
  });
}

export function useDeleteAdminItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'students' | 'teachers' | 'classrooms' }) => {
      const table = type === 'classrooms' ? 'aule' : 'profiles';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAdmin(queryClient),
  });
}
