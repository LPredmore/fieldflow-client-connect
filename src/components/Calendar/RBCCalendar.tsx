import { useCallback, useMemo, useState, useEffect } from 'react';
import { Calendar, luxonLocalizer, SlotInfo } from 'react-big-calendar';
import { DateTime } from 'luxon';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useStaffAppointments } from '@/hooks/useStaffAppointments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarIcon } from 'lucide-react';
import { CalendarToolbar } from './CalendarToolbar';
import { AppointmentEvent } from './AppointmentEvent';
import AppointmentView from '@/components/Appointments/AppointmentView';
import { CreateAppointmentDialog } from '@/components/Appointments/CreateAppointmentDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Luxon localizer for React Big Calendar
const localizer = luxonLocalizer(DateTime);

const STORAGE_KEY = 'calendar-working-hours-v2';
const DEFAULT_START = 7;
const DEFAULT_END = 21;

// Helper to create a plain local Date object at a specific hour
function createLocalTime(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

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
  // Use the unified staff appointments hook - timezone is handled server-side
  const { appointments, loading, refetch, staffTimezone } = useStaffAppointments({
    lookbackDays: 14,
  });
  const { tenantId } = useAuth();
  
  // Debug: log when appointments change
  console.log('[RBCCalendar] Render with appointments count:', appointments?.length ?? 0);
  
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

  // Plain local Date objects for min/max
  const minTime = useMemo(() => createLocalTime(workingHoursStart, 0), [workingHoursStart]);
  const maxTime = useMemo(() => createLocalTime(workingHoursEnd, 0), [workingHoursEnd]);
  const scrollToTime = useMemo(() => createLocalTime(workingHoursStart, 0), [workingHoursStart]);

  // Timezone mismatch indicator
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzMismatch = staffTimezone && staffTimezone !== browserTimezone;

  // Convert appointments to RBC event format using "fake local" Dates
  // The calendar_start and calendar_end Dates are constructed so getHours() returns
  // the staff's local hour, which react-big-calendar uses for grid positioning
  const events = useMemo(() => {
    if (!appointments || !Array.isArray(appointments)) return [];

    const mapped = appointments.map((appt) => ({
      id: appt.id,
      title: `${appt.service_name} - ${appt.client_name}`,
      // Use "fake local" Dates - getHours() returns staff's local hour
      start: appt.calendar_start,
      end: appt.calendar_end,
      resource: {
        status: appt.status,
        client_name: appt.client_name,
        service_name: appt.service_name,
        series_id: appt.series_id,
        is_telehealth: appt.is_telehealth,
        display_time: appt.display_time,
        display_end_time: appt.display_end_time,
      },
    }));

    // Debug logging
    if (mapped.length > 0) {
      const first = mapped[0];
      const firstAppt = appointments[0];
      console.log('[RBCCalendar] Events mapped:', {
        count: mapped.length,
        staffTimezone,
        firstEvent: {
          displayTime: firstAppt.display_time,
          calendarStartHour: first.start.getHours(),
          calendarStartMinute: first.start.getMinutes(),
        },
      });
    }

    return mapped;
  }, [appointments, staffTimezone]);

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
    setPrefilledDate(DateTime.fromJSDate(slotInfo.start).toFormat('yyyy-MM-dd'));
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Schedule Calendar
          </CardTitle>
          {tzMismatch && (
            <span className="text-xs text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-1 rounded border border-yellow-300 dark:border-yellow-700">
              Showing times in {staffTimezone}
            </span>
          )}
        </div>
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
              onDelete={() => setViewDialogOpen(false)}
              onRefresh={() => {
                refetch();
                setSelectedAppointmentId(null);
              }}
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
        onAppointmentCreated={refetch}
      />
    </Card>
  );
}
