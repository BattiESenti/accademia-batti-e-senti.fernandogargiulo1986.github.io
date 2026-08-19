import { useEffect, useState, type FormEvent } from 'react';
import { useAdminClassrooms, useSaveClassroom, useUpdateProfile, useCreateUser } from '../hooks/useAdminData';
import type { AdminProfile, Aula } from '../types';

export type AdminItemType = 'students' | 'teachers' | 'classrooms';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: AdminItemType;
  item: AdminProfile | Aula | null;
}

const TYPE_LABEL: Record<AdminItemType, string> = {
  students: 'studente',
  teachers: 'insegnante',
  classrooms: 'aula',
};

export function AdminModal({ isOpen, onClose, type, item }: AdminModalProps) {
  const isProfile = type === 'students' || type === 'teachers';
  const isCreating = !item;

  const { data: classrooms } = useAdminClassrooms();
  const saveClassroom = useSaveClassroom();
  const updateProfile = useUpdateProfile();
  const createUser = useCreateUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [aulaDefaultId, setAulaDefaultId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (item) {
      if ('email' in item) {
        setName(item.nome);
        setEmail(item.email);
        setAulaDefaultId(item.aula_default_id ?? '');
      } else {
        setName(item.nome);
      }
    } else {
      setName('');
      setEmail('');
      setPassword('');
      setAulaDefaultId('');
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  const isSaving = saveClassroom.isPending || updateProfile.isPending || createUser.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    try {
      if (type === 'classrooms') {
        await saveClassroom.mutateAsync({ id: item?.id, nome: name });
      } else if (item) {
        await updateProfile.mutateAsync({
          id: item.id,
          nome: name,
          aulaDefaultId: type === 'teachers' ? (aulaDefaultId || null) : null,
        });
      } else {
        if (password.length < 6) {
          setError('La password deve essere di almeno 6 caratteri.');
          return;
        }
        await createUser.mutateAsync({
          email: email.trim(),
          password,
          nome: name,
          ruolo: type === 'students' ? 'student' : 'teacher',
          aulaDefaultId: type === 'teachers' ? (aulaDefaultId || null) : null,
        });
      }
      onClose();
    } catch (err) {
      setError('Errore: ' + (err instanceof Error ? err.message : 'operazione non riuscita'));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 className="text-xl font-bold mb-4">{isCreating ? 'Nuovo' : 'Modifica'} {TYPE_LABEL[type]}</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {isProfile && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  readOnly={!isCreating}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 read-only:bg-gray-100"
                />
              </div>
            )}

            {isProfile && isCreating && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Password Provvisoria</label>
                <input
                  type="password"
                  required
                  placeholder="Min. 6 caratteri"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}

            {type === 'teachers' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Aula di Default</label>
                <select
                  value={aulaDefaultId}
                  onChange={(e) => setAulaDefaultId(e.target.value)}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Nessuna</option>
                  {classrooms?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
          </div>

          {error && <div className="text-sm text-center text-red-600 mt-4">{error}</div>}

          <div className="mt-6 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSaving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
