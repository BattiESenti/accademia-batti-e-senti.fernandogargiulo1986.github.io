import { useMemo, useState } from 'react';
import { useAdminProfiles, useAdminClassrooms, useDeleteAdminItem } from '../hooks/useAdminData';
import { AdminModal, type AdminItemType } from '../components/AdminModal';
import type { AdminProfile, Aula } from '../types';

const TABS: { key: AdminItemType; label: string }[] = [
  { key: 'students', label: 'Studenti' },
  { key: 'teachers', label: 'Insegnanti' },
  { key: 'classrooms', label: 'Aule' },
];

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminItemType>('students');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminProfile | Aula | null>(null);

  const { data: profiles, isError: profilesError } = useAdminProfiles();
  const { data: classrooms, isError: classroomsError } = useAdminClassrooms();
  const deleteItem = useDeleteAdminItem();

  const students = useMemo(() => profiles?.filter((p) => p.ruolo === 'student') ?? [], [profiles]);
  const teachers = useMemo(() => profiles?.filter((p) => p.ruolo === 'teacher') ?? [], [profiles]);

  function openCreate() {
    setEditingItem(null);
    setModalOpen(true);
  }

  function openEdit(item: AdminProfile | Aula) {
    setEditingItem(item);
    setModalOpen(true);
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Sei sicuro di voler eliminare "${name}"?`)) return;
    try {
      await deleteItem.mutateAsync({ id, type: activeTab });
    } catch (err) {
      alert('Errore: ' + (err instanceof Error ? err.message : 'operazione non riuscita'));
    }
  }

  const addButtonLabel = activeTab === 'students' ? 'Aggiungi Studente' : activeTab === 'teachers' ? 'Aggiungi Insegnante' : 'Aggiungi Aula';

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md flex-grow flex flex-col overflow-auto">
      <h2 className="text-2xl font-bold mb-4">Pannello di Amministrazione</h2>

      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-4 sm:space-x-8 overflow-x-auto -mb-px" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'text-indigo-600 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          {addButtonLabel}
        </button>
      </div>

      {activeTab === 'classrooms' ? (
        <ClassroomsTable
          classrooms={classrooms}
          isError={classroomsError}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      ) : (
        <ProfilesTable
          rows={activeTab === 'students' ? students : teachers}
          showClassroom={activeTab === 'teachers'}
          isError={profilesError}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      <AdminModal isOpen={modalOpen} onClose={() => setModalOpen(false)} type={activeTab} item={editingItem} />
    </div>
  );
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="px-6 py-4 space-x-2 text-right">
      <button onClick={onEdit} className="inline-block min-h-11 px-2 py-1.5 text-indigo-600 hover:text-indigo-900">Modifica</button>
      <button onClick={onDelete} className="inline-block min-h-11 px-2 py-1.5 text-red-600 hover:text-red-900">Elimina</button>
    </td>
  );
}

function ProfilesTable({
  rows, showClassroom, isError, onEdit, onDelete,
}: {
  rows: AdminProfile[];
  showClassroom: boolean;
  isError: boolean;
  onEdit: (item: AdminProfile) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            {showClassroom && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aula Default</th>}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {isError ? (
            <tr><td colSpan={4} className="px-6 py-4 text-center text-red-500">Errore nel caricamento dei dati.</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">Nessun dato disponibile.</td></tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td className="px-6 py-4 text-sm">{r.nome}</td>
                <td className="px-6 py-4 text-sm">{r.email}</td>
                {showClassroom && <td className="px-6 py-4 text-sm">{r.aula_default_nome ?? '-'}</td>}
                <ActionButtons onEdit={() => onEdit(r)} onDelete={() => onDelete(r.id, r.nome || r.email)} />
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ClassroomsTable({
  classrooms, isError, onEdit, onDelete,
}: {
  classrooms: Aula[] | undefined;
  isError: boolean;
  onEdit: (item: Aula) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome Aula</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {isError ? (
            <tr><td colSpan={2} className="px-6 py-4 text-center text-red-500">Errore nel caricamento dei dati.</td></tr>
          ) : !classrooms || classrooms.length === 0 ? (
            <tr><td colSpan={2} className="px-6 py-4 text-center text-gray-500">Nessun dato disponibile.</td></tr>
          ) : (
            classrooms.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-4 text-sm">{c.nome}</td>
                <ActionButtons onEdit={() => onEdit(c)} onDelete={() => onDelete(c.id, c.nome)} />
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
