import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTeachers } from '../hooks/useProfiles';
import type { AppuntamentoRelations } from '../types';

function useNotesAppointments(teacherFilterId: string) {
  const { profile, user } = useAuth();

  return useQuery({
    queryKey: ['notes-appointments', profile?.ruolo, user?.id, teacherFilterId],
    enabled: !!profile,
    queryFn: async (): Promise<AppuntamentoRelations[]> => {
      let query = supabase
        .from('appuntamenti')
        .select('*, studente_id(id, nome), insegnante_id(id, nome), aula_id(id, nome)');

      if (profile!.ruolo === 'admin') {
        if (teacherFilterId && teacherFilterId !== 'all') {
          query = query.eq('insegnante_id', teacherFilterId);
        }
      } else if (profile!.ruolo === 'teacher') {
        query = query.eq('insegnante_id', user!.id);
      } else {
        query = query.eq('studente_id', user!.id);
      }

      const { data, error } = await query.order('data_inizio', { ascending: false });
      if (error) throw error;
      return data as unknown as AppuntamentoRelations[];
    },
  });
}

export function NotesPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.ruolo === 'admin';
  const isTeacher = profile?.ruolo === 'teacher';

  const [teacherFilterId, setTeacherFilterId] = useState('all');
  const [studentFilterId, setStudentFilterId] = useState('all');

  const { data: teachers } = useTeachers();
  const { data: appointments } = useNotesAppointments(teacherFilterId);

  const students = useMemo(() => {
    const map = new Map<string, string>();
    appointments?.forEach((apt) => {
      if (apt.studente_id) map.set(apt.studente_id.id, apt.studente_id.nome);
    });
    return [...map.entries()];
  }, [appointments]);

  const filtered = useMemo(() => {
    if (!appointments) return [];
    if (studentFilterId === 'all') return appointments;
    return appointments.filter((apt) => apt.studente_id?.id === studentFilterId);
  }, [appointments, studentFilterId]);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md flex-grow overflow-auto">
      <h2 className="text-2xl font-bold mb-4">Appuntamenti & Note</h2>

      {(isTeacher || isAdmin) && (
        <div className="flex flex-wrap gap-4 mb-4">
          {isAdmin && (
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Insegnante:</label>
              <select
                value={teacherFilterId}
                onChange={(e) => setTeacherFilterId(e.target.value)}
                className="text-sm rounded-md border-gray-300"
              >
                <option value="all">Tutti gli Insegnanti</option>
                {teachers?.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Studente:</label>
            <select
              value={studentFilterId}
              onChange={(e) => setStudentFilterId(e.target.value)}
              className="text-sm rounded-md border-gray-300"
            >
              <option value="all">Tutti gli Studenti</option>
              {students.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ora</th>
              {profile?.ruolo !== 'student' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Studente</th>
              )}
              {profile?.ruolo !== 'teacher' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Insegnante</th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aula</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">Nessun appuntamento trovato.</td>
              </tr>
            ) : (
              filtered.map((apt) => {
                const start = new Date(apt.data_inizio);
                return (
                  <tr key={apt.id}>
                    <td className="px-6 py-4">{start.toLocaleDateString('it-IT')}</td>
                    <td className="px-6 py-4">{start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</td>
                    {profile?.ruolo !== 'student' && <td className="px-6 py-4">{apt.studente_id?.nome ?? 'N/D'}</td>}
                    {profile?.ruolo !== 'teacher' && <td className="px-6 py-4">{apt.insegnante_id?.nome ?? 'N/D'}</td>}
                    <td className="px-6 py-4">{apt.aula_id?.nome ?? 'N/D'}</td>
                    <td className="px-6 py-4 text-sm">{apt.note}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
