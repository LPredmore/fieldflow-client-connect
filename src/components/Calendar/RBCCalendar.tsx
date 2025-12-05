import { useCallback, useMemo, useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useCalendarAppointments } from '@/hooks/useCalendarAppointments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarIcon } from 'lucide-react';
import { CalendarToolbar } from './CalendarToolbar';
import { AppointmentEvent } from './AppointmentEvent';
import AppointmentView from '@/components/Appointments/AppointmentView';
import { CreateAppointmentDialog } from '@/components/Appointments/CreateAppointmentDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const locales = { 'en-US': enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const STORAGE_KEY = 'calendar-working-hours';
const DEFAULT_START = 7;
const DEFAULT_END = 21;

// Explicit formats to ensure consistent 12-hour AM/PM display
// Using 'h:mm a' pattern instead of 'p' token which has UTC interpretation issues
const formats = {
  timeGutterFormat: 'h:mm a',
  eventTimeRangeFormat: (
    { start, end }: { start: Date; end: Date },
    culture?: string,
    localizer?: any
  ) => `${localizer.format(start, 'h:mm a', culture)} – ${localizer.format(end, 'h:mm a', culture)}`,
  eventTimeRangeStartFormat: (
    { start }: { start: Date },
    culture?: string,
    localizer?: any
  ) => `${localizer.format(start, 'h:mm a', culture)} –`,
  eventTimeRangeEndFormat: (
    { end }: { end: Date },
    culture?: string,
    localizer?: any
  ) => `– ${localizer.format(end, 'h:mm a', culture)}`,
  selectRangeFormat: (
    { start, end }: { start: Date; end: Date },
    culture?: string,
    localizer?: any
  ) => `${localizer.format(start, 'h:mm a', culture)} – ${localizer.format(end, 'h:mm a', culture)}`,
};

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
  const { appointments, loading, refetch } = useCalendarAppointments();
  const { tenantId } = useAuth();
  
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState<string>('');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  
  // Working hours state with localStorage persistence
  const [workingHoursStart, setWorkingHoursStart] = useState(() => loadWorkingHours().start);
  const [workingHoursEnd, setWorkingHoursEnd] = useState(() => loadWorkingHours().end);

  const handleWorkingHoursChange = useCallback((start: number, end: number) => {
    setWorkingHoursStart(start);
    setWorkingHoursEnd(end);
    saveWorkingHours(start, end);
  }, []);

  // Convert hours to Date objects for min/max props
  // react-big-calendar uses local time (getHours()), so we use setHours()
  const minTime = useMemo(() => {
    const date = new Date();
    date.setHours(workingHoursStart, 0, 0, 0);
    return date;
  }, [workingHoursStart]);

  const maxTime = useMemo(() => {
    const date = new Date();
    // For 11 PM (hour 23), set to 23:59 to include the full hour
    if (workingHoursEnd === 23) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(workingHoursEnd, 0, 0, 0);
    }
    return date;
  }, [workingHoursEnd]);

  const scrollToTime = useMemo(() => {
    const date = new Date();
    date.setHours(workingHoursStart, 0, 0, 0);
    return date;
  }, [workingHoursStart]);

  // Convert appointments to RBC event format
  // Use pre-computed local_start/local_end from useCalendarAppointments
  // which correctly handles Supabase's non-standard timestamp format
  const events = useMemo(() => {
    if (!appointments || !Array.isArray(appointments)) return [];

    return appointments.map((appt) => ({
      id: appt.id,
      title: `${appt.service_name} - ${appt.client_name}`,
      // Use pre-computed local times (already converted from UTC)
      start: appt.local_start || new Date(),
      end: appt.local_end || new Date(),
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
    setSelectedAppointmentId(event.id);
    setViewDialogOpen(true);
  }, []);

  // Handle slot selection
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setPrefilledDate(format(slotInfo.start, 'yyyy-MM-dd'));
    setCreateDialogOpen(true);
  }, []);

  // Fetch full appointment data when selected
  useEffect(() => {
    if (!selectedAppointmentId || !tenantId) {
      setSelectedAppointment(null);
      return;
    }

    const fetchAppointment = async () => {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select(`
            *,
            clients!inner(pat_name_f, pat_name_l, pat_name_m, pat_name_preferred, email, phone),
            services!inner(id, name)
          `)
          .eq('id', selectedAppointmentId)
          .eq('tenant_id', tenantId)
          .single();

        if (error) throw error;
        
        const clientName = data.clients?.pat_name_preferred || 
          [data.clients?.pat_name_f, data.clients?.pat_name_m, data.clients?.pat_name_l]
            .filter(Boolean).join(' ').trim() || 'Unknown Client';

        setSelectedAppointment({
          ...data,
          client_name: clientName,
          service_name: data.services?.name || 'Unknown Service',
        });
      } catch (error) {
        console.error('Error fetching appointment:', error);
        setSelectedAppointment(null);
      }
    };

    fetchAppointment();
  }, [selectedAppointmentId, tenantId]);

  // Handle appointment update
  const handleUpdateAppointment = async (appointmentId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      
      setViewDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  };

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
            culture="en-US"
            formats={formats}
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
            components={{
              toolbar: (props) => (
                <CalendarToolbar
                  {...props}
                  workingHoursStart={workingHoursStart}
                  workingHoursEnd={workingHoursEnd}
                  onWorkingHoursChange={handleWorkingHoursChange}
                />
              ),
              event: AppointmentEvent,
            }}
            min={minTime}
            max={maxTime}
            scrollToTime={scrollToTime}
          />
        </div>
      </CardContent>

      {/* Appointment View Dialog */}
      {selectedAppointment && (
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Appointment Details</DialogTitle>
            </DialogHeader>
            <AppointmentView 
              job={selectedAppointment}
              onUpdate={handleUpdateAppointment}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Create Appointment Dialog */}
      <CreateAppointmentDialog
        prefilledDate={prefilledDate}
        trigger={null}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </Card>
  );
}
