import { useCallback, useMemo, useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useAppointments } from '@/hooks/useAppointments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon } from 'lucide-react';
import { CalendarToolbar } from './CalendarToolbar';

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

  // DEBUG: Log working hours state values
  console.log('=== CALENDAR DEBUG ===');
  console.log('workingHoursStart (raw number):', workingHoursStart);
  console.log('workingHoursEnd (raw number):', workingHoursEnd);
  
  // DEBUG: Test what format produces for different hours
  const testDate7AM = new Date(2000, 0, 1, 7, 0, 0);
  const testDate19PM = new Date(2000, 0, 1, 19, 0, 0);
  console.log('=== FORMAT TEST ===');
  console.log('Test 7 AM Date:', testDate7AM);
  console.log('Test 7 AM getHours():', testDate7AM.getHours());
  console.log('Test 7 AM formatted with h:mm a:', format(testDate7AM, 'h:mm a'));
  console.log('Test 19 (7PM) Date:', testDate19PM);
  console.log('Test 19 (7PM) getHours():', testDate19PM.getHours());
  console.log('Test 19 (7PM) formatted with h:mm a:', format(testDate19PM, 'h:mm a'));

  const handleWorkingHoursChange = useCallback((start: number, end: number) => {
    setWorkingHoursStart(start);
    setWorkingHoursEnd(end);
    saveWorkingHours(start, end);
  }, []);

  // Create min/max time Date objects
  // Use a fixed date (Jan 1, 2000) to avoid DST issues
  const minTime = useMemo(() => {
    return new Date(2000, 0, 1, workingHoursStart, 0, 0);
  }, [workingHoursStart]);

  const maxTime = useMemo(() => {
    return new Date(2000, 0, 1, workingHoursEnd, 0, 0);
  }, [workingHoursEnd]);

  const scrollToTime = useMemo(() => {
    return new Date(2000, 0, 1, workingHoursStart, 0, 0);
  }, [workingHoursStart]);

  // DEBUG: Log the Date objects and their hour values
  console.log('=== MIN/MAX TIME DEBUG ===');
  console.log('minTime Date object:', minTime);
  console.log('minTime.getHours():', minTime.getHours());
  console.log('minTime.toISOString():', minTime.toISOString());
  console.log('minTime.toString():', minTime.toString());
  console.log('---');
  console.log('maxTime Date object:', maxTime);
  console.log('maxTime.getHours():', maxTime.getHours());
  console.log('maxTime.toISOString():', maxTime.toISOString());
  console.log('maxTime.toString():', maxTime.toString());
  console.log('---');
  console.log('scrollToTime.getHours():', scrollToTime.getHours());
  console.log('=== END DEBUG ===');

  // Convert appointments to RBC event format
  const events = useMemo(() => {
    if (!appointments || !Array.isArray(appointments)) return [];

    return appointments.map((appt) => ({
      id: appt.id,
      title: `${appt.service_name} - ${appt.client_name}`,
      start: new Date(appt.start_at),
      end: new Date(appt.end_at),
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
