import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTeachers, useStudents, useClassrooms } from '../hooks/useProfiles';
import {
  useCreateAppointment,
  useCreateRecurringAppointments,
  useUpdateAppointment,
  useDeleteAppointment,
} from '../hooks/useAppointments';
import type { AppuntamentoRelations } from '../types';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** null = creazione nuovo appuntamento; altrimenti appuntamento esistente */
  appointment: AppuntamentoRelations | null;
  /** Data/orari di default precompilati quando si crea un nuovo appuntamento
   * (es. selezionando uno slot dal calendario invece di usare il bottone +) */
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function AppointmentModal({ isOpen, onClose, appointment, defaultDate, defaultStartTime, defaultEndTime }: AppointmentModalProps) {
  const { profile, user } = useAuth();
  const { data: teachers } = useTeachers();
  const { data: students } = useStudents();
  const { data: classrooms } = useClassrooms();

  const createAppointment = useCreateAppointment();
  const createRecurring = useCreateRecurringAppointments();
  const updateAppointment = useUpdateAppointment();
  const deleteAppointment = useDeleteAppointment();

  const isCreate = appointment === null;
  const canEdit = isCreate
    || profile?.ruolo === 'admin'
    || (profile?.ruolo === 'teacher' && appointment.insegnante_id?.id === user?.id);

  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setRecurring(false);
    setRecurringEndDate('');

    if (isCreate) {
      setStudentId('');
      setNotes('');
      setDate(defaultDate ?? new Date().toISOString().slice(0, 10));
      setStartTime(defaultStartTime ?? '');
      setEndTime(defaultEndTime ?? '');
      if (profile?.ruolo === 'teacher') {
        setTeacherId(user!.id);
        setClassroomId(profile.aula_default_id ?? '');
      } else {
        setTeacherId('');
        setClassroomId('');
      }
    } else {
      setStudentId(appointment.studente_id?.id ?? '');
      setTeacherId(appointment.insegnante_id?.id ?? '');
      setClassroomId(appointment.aula_id?.id ?? '');
      setNotes(appointment.note ?? '');
      const start = new Date(appointment.data_inizio);
      setDate(start.toISOString().slice(0, 10));
      setStartTime(start.toTimeString().slice(0, 5));
      setEndTime(new Date(appointment.data_fine).toTimeString().slice(0, 5));
    }
  }, [isOpen, isCreate, appointment, defaultDate, defaultStartTime, defaultEndTime, profile, user]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!canEdit) {
      onClose();
      return;
    }

    const payload = {
      studente_id: studentId,
      insegnante_id: profile!.ruolo === 'teacher' ? user!.id : teacherId,
      aula_id: classroomId,
      note: notes,
    };

    try {
      if (!isCreate) {
        await updateAppointment.mutateAsync({ id: appointment.id, payload });
        onClose();
        return;
      }

      if (!date || !startTime || !endTime) {
        setError('Inserisci data, ora di inizio e ora di fine.');
        return;
      }
      if (endTime <= startTime) {
        setError("L'orario di fine deve essere successivo all'inizio.");
        return;
      }

      const startISO = new Date(`${date}T${startTime}`).toISOString();
      const endISO = new Date(`${date}T${endTime}`).toISOString();

      if (recurring && recurringEndDate) {
        const endLimit = new Date(`${recurringEndDate}T23:59:59`);
        let cursorStart = new Date(startISO);
        let cursorEnd = new Date(endISO);
        const appointments: (typeof payload & { data_inizio: string; data_fine: string })[] = [];

        while (cursorStart <= endLimit) {
          appointments.push({
            ...payload,
            data_inizio: cursorStart.toISOString(),
            data_fine: cursorEnd.toISOString(),
          });
          cursorStart = new Date(cursorStart.getTime() + WEEK_MS);
          cursorEnd = new Date(cursorEnd.getTime() + WEEK_MS);
        }
        await createRecurring.mutateAsync(appointments);
      } else {
        await createAppointment.mutateAsync({ ...payload, data_inizio: startISO, data_fine: endISO });
      }
      onClose();
    } catch (err) {
      setError('Errore: ' + (err instanceof Error ? err.message : 'operazione non riuscita'));
    }
  }

  async function handleDelete() {
    if (isCreate) return;
    if (!window.confirm('Sei sicuro di voler eliminare questo appuntamento?')) return;
    try {
      await deleteAppointment.mutateAsync(appointment.id);
      onClose();
    } catch (err) {
      setError('Errore: ' + (err instanceof Error ? err.message : 'operazione non riuscita'));
    }
  }

  const isSaving = createAppointment.isPending || createRecurring.isPending || updateAppointment.isPending;
  const teacherLocked = profile?.ruolo === 'teacher';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">{isCreate ? 'Nuovo Appuntamento' : 'Dettagli Appuntamento'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {canEdit ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Studente</label>
                    <select
                      required
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Seleziona...</option>
                      {students?.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Insegnante</label>
                    <select
                      required
                      value={teacherId}
                      disabled={teacherLocked}
                      onChange={(e) => setTeacherId(e.target.value)}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                    >
                      <option value="">Seleziona...</option>
                      {teachers?.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Aula</label>
                    <select
                      required
                      value={classroomId}
                      onChange={(e) => setClassroomId(e.target.value)}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Seleziona...</option>
                      {classrooms?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-800 bg-gray-50 p-2 rounded-md">Studente: {appointment?.studente_id?.nome ?? 'N/D'}</p>
                  <p className="text-gray-800 bg-gray-50 p-2 rounded-md">Insegnante: {appointment?.insegnante_id?.nome ?? 'N/D'}</p>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Orario</label>
                {isCreate ? (
                  <div className="space-y-2 mt-1">
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Inizio</label>
                        <input
                          type="time"
                          required
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Fine</label>
                        <input
                          type="time"
                          required
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-gray-800">
                    {new Date(appointment!.data_inizio).toLocaleDateString('it-IT')}{' '}
                    {new Date(appointment!.data_inizio).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(appointment!.data_fine).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Note</label>
                <textarea
                  rows={3}
                  readOnly={!canEdit}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 read-only:bg-gray-100"
                />
              </div>

              {isCreate && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Ricorrenza settimanale</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={recurring}
                      onClick={() => setRecurring((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        recurring ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          recurring ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {recurring && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700">Ripeti fino al</label>
                      <input
                        type="date"
                        value={recurringEndDate}
                        onChange={(e) => setRecurringEndDate(e.target.value)}
                        className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="mt-6 flex justify-between items-center">
              <div>
                {!isCreate && canEdit && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    Elimina
                  </button>
                )}
              </div>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Annulla
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isSaving ? 'Salvataggio...' : 'Salva'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
