import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface AggregatedRow {
  key: string;
  primaryLabel: string;
  secondaryLabel?: string;
  counts: Record<string, number>;
}

interface SummaryResult {
  months: string[];
  studentRows: AggregatedRow[];
  teacherRows: AggregatedRow[];
  from: string;
  to: string;
}

type Mode = 'student' | 'teacher';

function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
}

function rowTotal(row: AggregatedRow): number {
  return Object.values(row.counts).reduce((a, b) => a + b, 0);
}

export function SummaryPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [mode, setMode] = useState<Mode>('student');

  async function generate() {
    setError('');
    setResult(null);

    if (!from || !to) {
      setError('Seleziona un intervallo di date.');
      return;
    }
    if (to < from) {
      setError('La data di fine deve essere successiva alla data di inizio.');
      return;
    }

    setLoading(true);

    const [
      { data: appointments, error: apptError },
      { data: allStudents, error: studentsError },
      { data: allTeachers, error: teachersError },
    ] = await Promise.all([
      supabase
        .from('appuntamenti')
        .select('data_inizio, studente_id(id, nome), insegnante_id(id, nome)')
        .gte('data_inizio', `${from}T00:00:00`)
        .lte('data_inizio', `${to}T23:59:59`)
        .order('data_inizio', { ascending: true }),
      supabase.from('profiles').select('id, nome').eq('ruolo', 'student').order('nome'),
      supabase.from('profiles').select('id, nome').eq('ruolo', 'teacher').order('nome'),
    ]);

    setLoading(false);

    if (apptError) { setError('Errore: ' + apptError.message); return; }
    if (studentsError) { setError('Errore: ' + studentsError.message); return; }
    if (teachersError) { setError('Errore: ' + teachersError.message); return; }

    const months: string[] = [];
    const cursor = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    cursor.setDate(1);
    end.setDate(1);
    while (cursor <= end) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    type AptRow = {
      data_inizio: string;
      studente_id: { id: string; nome: string } | null;
      insegnante_id: { id: string; nome: string } | null;
    };
    const rows = (appointments as unknown as AptRow[] | null) ?? [];

    // Vista per studente: raggruppa per coppia studente+insegnante, cosi uno
    // studente con lezioni presso piu insegnanti compare su piu righe.
    const studentRowMap = new Map<string, AggregatedRow>();
    const studentsWithLessons = new Set<string>();

    rows.forEach((apt) => {
      const student = apt.studente_id;
      if (!student) return;
      studentsWithLessons.add(student.id);

      const teacher = apt.insegnante_id;
      const key = `${student.id}|${teacher?.id ?? 'none'}`;
      if (!studentRowMap.has(key)) {
        studentRowMap.set(key, { key, primaryLabel: student.nome, secondaryLabel: teacher?.nome ?? 'N/D', counts: {} });
      }
      const monthKey = apt.data_inizio.slice(0, 7);
      const row = studentRowMap.get(key)!;
      row.counts[monthKey] = (row.counts[monthKey] ?? 0) + 1;
    });

    allStudents?.forEach((s) => {
      if (!studentsWithLessons.has(s.id)) {
        studentRowMap.set(`${s.id}|none`, { key: `${s.id}|none`, primaryLabel: s.nome, secondaryLabel: 'N/D', counts: {} });
      }
    });

    const studentRows = [...studentRowMap.values()].sort((a, b) =>
      a.primaryLabel.localeCompare(b.primaryLabel) || (a.secondaryLabel ?? '').localeCompare(b.secondaryLabel ?? '')
    );

    // Vista per insegnante: totale lezioni per mese, sommando tutti gli studenti.
    const teacherRowMap = new Map<string, AggregatedRow>();
    const teachersWithLessons = new Set<string>();

    rows.forEach((apt) => {
      const teacher = apt.insegnante_id;
      if (!teacher) return;
      teachersWithLessons.add(teacher.id);

      if (!teacherRowMap.has(teacher.id)) {
        teacherRowMap.set(teacher.id, { key: teacher.id, primaryLabel: teacher.nome, counts: {} });
      }
      const monthKey = apt.data_inizio.slice(0, 7);
      const row = teacherRowMap.get(teacher.id)!;
      row.counts[monthKey] = (row.counts[monthKey] ?? 0) + 1;
    });

    allTeachers?.forEach((t) => {
      if (!teachersWithLessons.has(t.id)) {
        teacherRowMap.set(t.id, { key: t.id, primaryLabel: t.nome, counts: {} });
      }
    });

    const teacherRows = [...teacherRowMap.values()].sort((a, b) => a.primaryLabel.localeCompare(b.primaryLabel));

    setResult({ months, studentRows, teacherRows, from, to });
  }

  function downloadExcel() {
    if (!result) return;
    const { months, studentRows, teacherRows, from, to } = result;

    const wb = XLSX.utils.book_new();

    const studentHeader = ['Studente', 'Insegnante', ...months.map(monthLabel), 'Totale'];
    const studentData = studentRows.map((r) => [r.primaryLabel, r.secondaryLabel ?? '', ...months.map((m) => r.counts[m] ?? 0), rowTotal(r)]);
    const wsStudents = XLSX.utils.aoa_to_sheet([studentHeader, ...studentData]);
    XLSX.utils.book_append_sheet(wb, wsStudents, 'Per Studente');

    const teacherHeader = ['Insegnante', ...months.map(monthLabel), 'Totale'];
    const teacherData = teacherRows.map((r) => [r.primaryLabel, ...months.map((m) => r.counts[m] ?? 0), rowTotal(r)]);
    const wsTeachers = XLSX.utils.aoa_to_sheet([teacherHeader, ...teacherData]);
    XLSX.utils.book_append_sheet(wb, wsTeachers, 'Per Insegnante');

    XLSX.writeFile(wb, `riepilogo_lezioni_${from}_${to}.xlsx`);
  }

  const activeRows = result ? (mode === 'student' ? result.studentRows : result.teacherRows) : [];

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md flex-grow overflow-auto">
      <h2 className="text-2xl font-bold mb-4">Riepilogo Lezioni</h2>

      <div className="flex flex-wrap gap-4 items-end mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dal</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Al</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? 'Caricamento...' : 'Genera riepilogo'}
        </button>
        {result && (
          <button
            onClick={downloadExcel}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Scarica Excel
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('student')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${mode === 'student' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Per Studente
            </button>
            <button
              onClick={() => setMode('teacher')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${mode === 'teacher' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Per Insegnante
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    {mode === 'student' ? 'Studente' : 'Insegnante'}
                  </th>
                  {mode === 'student' && (
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Insegnante</th>
                  )}
                  {result.months.map((m) => (
                    <th key={m} className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">{monthLabel(m)}</th>
                  ))}
                  <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">Totale</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeRows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.primaryLabel}</td>
                    {mode === 'student' && <td className="px-4 py-3 text-gray-700">{r.secondaryLabel}</td>}
                    {result.months.map((m) => (
                      <td key={m} className="px-4 py-3 text-center text-gray-700">{r.counts[m] ?? 0}</td>
                    ))}
                    <td className="px-4 py-3 text-center font-bold text-indigo-700">{rowTotal(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
