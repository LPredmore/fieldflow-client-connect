import { useCallback, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useAppointments } from '@/hooks/useAppointments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon } from 'lucide-react';
import { CalendarToolbar } from './CalendarToolbar';
import { createLocalTimeDate } from '@/lib/appointmentTime';

const locales = { 'en-US': enUS };

const formats = {
  timeGutterFormat: 'h:mm a',
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const STORAGE_KEY = 'calendar-working-hours-v3';
const DEFAULT_START = 7;
const DEFAULT_END = 21;

function loadWorkingHours(): { start: number; end: number } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.start === 'number' && typeof parsed.end === 'number') {
        return parsed;
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
  return { start: DEFAULT_START, end: DEFAULT_END };
}

function saveWorkingHours(start: number, end: number) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ start, end }));
}

export function RBCCalendar() {
  const { appointments, loading } = useAppointments();
  
  // Working hours state with localStorage persistence
  const [workingHoursStart, setWorkingHoursStart] = useState(() => loadWorkingHours().start);
  const [workingHoursEnd, setWorkingHoursEnd] = useState(() => loadWorkingHours().end);

  const handleWorkingHoursChange = useCallback((start: number, end: number) => {
    setWorkingHoursStart(start);
    setWorkingHoursEnd(end);
    saveWorkingHours(start, end);
  }, []);

  // Create min/max time Date objects using Luxon for correct local time
  // These Dates will have getHours() === the expected hour
  const minTime = useMemo(() => createLocalTimeDate(workingHoursStart), [workingHoursStart]);
  const maxTime = useMemo(() => createLocalTimeDate(workingHoursEnd), [workingHoursEnd]);
  const scrollToTime = useMemo(() => createLocalTimeDate(workingHoursStart), [workingHoursStart]);

  // Convert appointments to RBC event format
  // Use start_local and end_local which are already converted to local timezone
  const events = useMemo(() => {
    if (!appointments || !Array.isArray(appointments)) return [];

    return appointments.map((appt) => ({
      id: appt.id,
      title: `${appt.service_name} - ${appt.client_name}`,
      start: appt.start_local, // Already local JS Date from useAppointments
      end: appt.end_local,     // Already local JS Date from useAppointments
      resource: {
        status: appt.status,
        client_name: appt.client_name,
        service_name: appt.service_name,
        series_id: appt.series_id,
        is_telehealth: appt.is_telehealth,
      },
    }));
  }, [appointments]);

  // Dynamic event styling based on status
  const eventStyleGetter = useCallback((event: any) => {
    let backgroundColor = 'hsl(var(--primary))';

    if (event.resource.status === 'completed') {
      backgroundColor = 'hsl(142.1 76.2% 36.3%)'; // green
    } else if (event.resource.status === 'cancelled') {
      backgroundColor = 'hsl(var(--destructive))';
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  }, []);

  // Handle event click
  const handleSelectEvent = useCallback((event: any) => {
    console.log('Selected event:', event);
    // TODO: Open appointment detail dialog
  }, []);

  // Handle slot selection
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    console.log('Selected slot:', slotInfo);
    // TODO: Open create appointment dialog
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Loading Calendar...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-96 bg-muted rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Schedule Calendar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="calendar-container h-[600px]">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            defaultView="week"
            views={['month', 'week', 'day']}
            step={30}
            showMultiDayTimes
            selectable
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            eventPropGetter={eventStyleGetter}
            formats={formats}
            components={{
              toolbar: (props) => (
                <CalendarToolbar
                  {...props}
                  workingHoursStart={workingHoursStart}
                  workingHoursEnd={workingHoursEnd}
                  onWorkingHoursChange={handleWorkingHoursChange}
                />
              ),
            }}
            min={minTime}
            max={maxTime}
            scrollToTime={scrollToTime}
          />
        </div>
      </CardContent>
    </Card>
  );
}
