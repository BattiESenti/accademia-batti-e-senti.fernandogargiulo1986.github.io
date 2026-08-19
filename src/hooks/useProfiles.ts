import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Profile, Aula } from '../types';

export function useTeachers() {
  return useQuery({
    queryKey: ['profiles', 'teacher'],
    queryFn: async (): Promise<Pick<Profile, 'id' | 'nome'>[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('ruolo', 'teacher');
      if (error) throw error;
      return data;
    },
  });
}

export function useStudents() {
  return useQuery({
    queryKey: ['profiles', 'student'],
    queryFn: async (): Promise<Pick<Profile, 'id' | 'nome'>[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('ruolo', 'student');
      if (error) throw error;
      return data;
    },
  });
}

export function useClassrooms() {
  return useQuery({
    queryKey: ['aule'],
    queryFn: async (): Promise<Aula[]> => {
      const { data, error } = await supabase.from('aule').select('id, nome');
      if (error) throw error;
      return data;
    },
  });
}
