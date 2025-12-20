import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Calendar, luxonLocalizer, SlotInfo } from 'react-big-calendar';
import { DateTime, Settings } from 'luxon';
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
import { useStaffTimezone } from '@/hooks/useStaffTimezone';

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

// Format time for display using Luxon
function formatTime(date: Date): string {
  return DateTime.fromJSDate(date).toFormat('h:mm a');
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
  const { appointments, loading, refetch } = useCalendarAppointments();
  const { tenantId } = useAuth();
  const staffTimezone = useStaffTimezone();
  const previousDefaultZoneRef = useRef<string | null>(null);
  
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState<string>('');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  
  // Working hours state with localStorage persistence
  const [workingHoursStart, setWorkingHoursStart] = useState(() => loadWorkingHours().start);
  const [workingHoursEnd, setWorkingHoursEnd] = useState(() => loadWorkingHours().end);

  // Set Luxon's default zone to staff timezone for calendar rendering
  // This ensures react-big-calendar interprets all Date objects in staff's timezone
  useEffect(() => {
    if (staffTimezone) {
      // Save the previous default zone so we can restore it on unmount
      previousDefaultZoneRef.current = Settings.defaultZone?.name || null;
      Settings.defaultZone = staffTimezone;
      console.log('[RBCCalendar] Set Luxon defaultZone to staff timezone:', staffTimezone);
    }
    
    return () => {
      // Restore previous default zone on unmount
      if (previousDefaultZoneRef.current) {
        Settings.defaultZone = previousDefaultZoneRef.current;
        console.log('[RBCCalendar] Restored Luxon defaultZone to:', previousDefaultZoneRef.current);
      } else {
        Settings.defaultZone = 'system';
        console.log('[RBCCalendar] Restored Luxon defaultZone to system');
      }
    };
  }, [staffTimezone]);

  const handleWorkingHoursChange = useCallback((start: number, end: number) => {
    setWorkingHoursStart(start);
    setWorkingHoursEnd(end);
    saveWorkingHours(start, end);
  }, []);

  // Plain local Date objects for min/max - no UTC gymnastics
  const minTime = useMemo(() => {
    const min = createLocalTime(workingHoursStart, 0);
    console.log('[RBC] min:', min.toString(), 'hours:', min.getHours());
    return min;
  }, [workingHoursStart]);

  const maxTime = useMemo(() => {
    const max = createLocalTime(workingHoursEnd, 0);
    console.log('[RBC] max:', max.toString(), 'hours:', max.getHours());
    return max;
  }, [workingHoursEnd]);

  const scrollToTime = useMemo(() => {
    return createLocalTime(workingHoursStart, 0);
  }, [workingHoursStart]);

  // Get timezone info for debugging display
  const displayTimezone = appointments[0]?.display_timezone || staffTimezone;
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzMismatch = displayTimezone && displayTimezone !== browserTimezone;

  // Convert appointments to RBC event format
  // Time Model (Fixed):
  // - Database stores UTC timestamps (start_at, end_at)
  // - We pass TRUE UTC Date objects to the calendar (via DateTime.fromISO(...).toJSDate())
  // - Luxon's Settings.defaultZone is set to staff timezone
  // - React Big Calendar (with Luxon localizer) interprets dates in the default zone
  // - This ensures appointments display at the correct staff local time
  const events = useMemo(() => {
    if (!appointments || !Array.isArray(appointments)) return [];

    const mapped = appointments.map((appt) => {
      // Create TRUE UTC Date objects by parsing UTC timestamp and converting to JS Date
      // The Luxon localizer will then interpret these in Settings.defaultZone (staff TZ)
      const startDate = DateTime.fromISO(appt.start_at, { zone: 'utc' }).toJSDate();
      const endDate = DateTime.fromISO(appt.end_at, { zone: 'utc' }).toJSDate();
      
      return {
        id: appt.id,
        title: `${appt.service_name} - ${appt.client_name}`,
        // Pass TRUE UTC Date objects - Luxon localizer handles timezone display
        start: startDate,
        end: endDate,
        resource: {
          status: appt.status,
          client_name: appt.client_name,
          service_name: appt.service_name,
          series_id: appt.series_id,
          is_telehealth: appt.is_telehealth,
          // Include server display times for reference
          display_time: appt.display_time,
          display_end_time: appt.display_end_time,
          display_timezone: appt.display_timezone,
        },
      };
    });

    // Debug logging for calendar events
    if (mapped.length > 0) {
      const first = mapped[0];
      const firstAppt = appointments[0];
      
      // Parse in staff timezone to show expected display time
      const expectedDisplay = DateTime.fromISO(firstAppt.start_at, { zone: 'utc' })
        .setZone(staffTimezone);
      
      console.group('[TIMEZONE DEBUG] Calendar Events (Fixed)');
      console.log('Staff timezone:', staffTimezone);
      console.log('Luxon defaultZone:', Settings.defaultZone);
      console.log('First appointment:', {
        rawUTC: firstAppt.start_at,
        expectedLocalHour: expectedDisplay.hour,
        expectedLocalMinute: expectedDisplay.minute,
        serverDisplayTime: firstAppt?.display_time,
      });
      console.groupEnd();
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
              ⚠️ Browser TZ ({browserTimezone}) ≠ Staff TZ ({staffTimezone})
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
      />
    </Card>
  );
}
