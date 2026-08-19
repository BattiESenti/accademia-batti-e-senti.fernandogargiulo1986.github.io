import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventInput, DatesSetArg, DateSelectArg } from '@fullcalendar/core';
import itLocale from '@fullcalendar/core/locales/it';
import { useAuth } from '../contexts/AuthContext';
import { useTeachers } from '../hooks/useProfiles';
import { useCalendarAppointments, useOccupiedSlots, type DateRange } from '../hooks/useAppointments';
import { getEventColor } from '../lib/colors';
import { AppointmentModal } from '../components/AppointmentModal';
import type { AppuntamentoRelations } from '../types';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const listener = () => setIsMobile(mq.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);
  return isMobile;
}

export function CalendarPage() {
  const { profile } = useAuth();
  const isEditable = profile?.ruolo === 'admin' || profile?.ruolo === 'teacher';
  const isMobile = useIsMobile();
  const calendarRef = useRef<FullCalendar>(null);

  const [range, setRange] = useState<DateRange | null>(null);
  const [teacherFilterId, setTeacherFilterId] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppuntamentoRelations | null>(null);
  const [slotPrefill, setSlotPrefill] = useState<{ date: string; startTime: string; endTime: string } | null>(null);

  const { data: teachers } = useTeachers();
  const { data: appointments } = useCalendarAppointments(range, teacherFilterId);
  const { data: occupiedSlots } = useOccupiedSlots(range);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRange({ start: arg.startStr, end: arg.endStr });
  }, []);

  const events: EventInput[] = useMemo(() => {
    const apptEvents: EventInput[] = (appointments ?? []).map((apt) => ({
      id: apt.id,
      title: `${apt.studente_id?.nome ?? '?'} con ${apt.insegnante_id?.nome ?? '?'}`,
      start: apt.data_inizio,
      end: apt.data_fine,
      backgroundColor: getEventColor(apt.aula_id?.nome),
      borderColor: getEventColor(apt.aula_id?.nome),
      extendedProps: { appointment: apt },
    }));

    if (!occupiedSlots) return apptEvents;

    const occupiedEvents: EventInput[] = occupiedSlots
      .filter((slot) => slot.insegnante_id !== (profile?.ruolo === 'teacher' ? profile.id : null))
      .map((slot) => ({
        title: `Occupato (${slot.aula_nome ?? 'N/D'})`,
        start: slot.data_inizio,
        end: slot.data_fine,
        display: 'block',
        backgroundColor: getEventColor(slot.aula_nome),
        borderColor: getEventColor(slot.aula_nome),
        editable: false,
        extendedProps: { isOccupied: true },
      }));

    return [...apptEvents, ...occupiedEvents];
  }, [appointments, occupiedSlots, profile]);

  // Evita che la vista si apra sempre dalle 08:00: scorre fino a un'ora prima
  // del primo evento del periodo visibile, cosi le lezioni pomeridiane/serali
  // sono visibili senza dover scorrere manualmente.
  const scrollTime = useMemo(() => {
    const startTimes = events
      .map((e) => e.start)
      .filter((s): s is string => typeof s === 'string')
      .map((s) => new Date(s));
    if (startTimes.length === 0) return '08:00:00';

    const earliest = new Date(Math.min(...startTimes.map((d) => d.getTime())));
    const paddedHour = Math.max(8, earliest.getHours() - 1);
    return `${String(paddedHour).padStart(2, '0')}:00:00`;
  }, [events]);

  // scrollTime viene applicato da FullCalendar solo al montaggio/cambio vista;
  // se gli eventi arrivano dopo (fetch asincrono su una vista gia' montata),
  // forziamo lo scroll manualmente.
  useEffect(() => {
    calendarRef.current?.getApi().scrollToTime(scrollTime);
  }, [scrollTime]);

  function handleEventClick(arg: EventClickArg) {
    if (arg.event.extendedProps.isOccupied) return;
    const appointment = arg.event.extendedProps.appointment as AppuntamentoRelations | undefined;
    if (!appointment) return;
    setEditingAppointment(appointment);
    setModalOpen(true);
  }

  function openNewAppointment() {
    setEditingAppointment(null);
    setSlotPrefill(null);
    setModalOpen(true);
  }

  function handleSelect(info: DateSelectArg) {
    if (!isEditable) return;
    setEditingAppointment(null);
    setSlotPrefill({
      date: info.startStr.slice(0, 10),
      startTime: info.start.toTimeString().slice(0, 5),
      endTime: info.end.toTimeString().slice(0, 5),
    });
    setModalOpen(true);
    info.view.calendar.unselect();
  }

  return (
    <div className="bg-white p-2 sm:p-4 rounded-lg shadow-md flex-grow flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">
          <span className="hidden sm:inline">Calendario Appuntamenti</span>
          <span className="sm:hidden">Calendario</span>
        </h2>
        <div className="flex items-center gap-3">
          {isEditable && (
            <button
              onClick={openNewAppointment}
              title="Nuovo appuntamento"
              aria-label="Nuovo appuntamento"
              className="w-10 h-10 flex items-center justify-center text-xl leading-none font-medium text-white bg-indigo-600 rounded-full hover:bg-indigo-700"
            >
              +
            </button>
          )}
          {profile?.ruolo === 'admin' && (
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
        </div>
      </div>

      <div className="flex-grow min-h-0">
        <FullCalendar
          ref={calendarRef}
          key={isMobile ? 'mobile' : 'desktop'}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: isMobile ? 'timeGridDay,listWeek' : 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          locale={itLocale}
          slotMinTime="08:00:00"
          slotMaxTime="21:00:00"
          scrollTime={scrollTime}
          allDaySlot={false}
          height="100%"
          editable={isEditable}
          selectable={isEditable}
          select={handleSelect}
          events={events}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
        />
      </div>

      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        appointment={editingAppointment}
        defaultDate={slotPrefill?.date}
        defaultStartTime={slotPrefill?.startTime}
        defaultEndTime={slotPrefill?.endTime}
      />
    </div>
  );
}
