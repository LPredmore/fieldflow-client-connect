import { useCallback, useMemo, useState } from 'react';
import { Calendar, luxonLocalizer, SlotInfo } from 'react-big-calendar';
import { DateTime } from 'luxon';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useStaffAppointments } from '@/hooks/useStaffAppointments';
import { useStaffCalendarBlocks } from '@/hooks/useStaffCalendarBlocks';
import { useStaffTimezone } from '@/hooks/useStaffTimezone';
import { useServerNow } from '@/hooks/useServerNow';
import { useStaffAvailability } from '@/hooks/useStaffAvailability';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarIcon, Plus, Ban, Trash2 } from 'lucide-react';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarSettingsPanel } from './CalendarSettingsPanel';
import { AppointmentEvent } from './AppointmentEvent';
import AppointmentView from '@/components/Appointments/AppointmentView';
import { CreateAppointmentDialog } from '@/components/Appointments/CreateAppointmentDialog';
import { BlockTimeDialog } from './BlockTimeDialog';

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

interface RBCCalendarProps {
  showCreateButton?: boolean;
}

export function RBCCalendar({ showCreateButton = false }: RBCCalendarProps) {
  // Use the unified staff appointments hook - timezone is handled server-side
  const { appointments, loading, refetch, getAppointmentById, updateAppointment } = useStaffAppointments({
    lookbackDays: 14,
  });
  
  // Get staff timezone directly from auth context (independent of appointment loading)
  const authStaffTimezone = useStaffTimezone();
  
  // Server-authoritative "now" — same coordinate system as appointment positioning
  const { fakeLocalNow: serverNow } = useServerNow(authStaffTimezone);
  
  // Fetch availability schedule for shading
  const { slots: availabilitySlots, refetch: refetchAvailability } = useStaffAvailability();

  // Build availability lookup: Map<dayOfWeek, Array<{startMinutes, endMinutes}>>
  const availabilityMap = useMemo(() => {
    const map = new Map<number, Array<{ startMinutes: number; endMinutes: number }>>();
    const activeSlots = availabilitySlots.filter(s => s.is_active);
    for (const slot of activeSlots) {
      const [sh, sm] = slot.start_time.split(':').map(Number);
      const [eh, em] = slot.end_time.split(':').map(Number);
      const entry = { startMinutes: sh * 60 + (sm || 0), endMinutes: eh * 60 + (em || 0) };
      const existing = map.get(slot.day_of_week) || [];
      existing.push(entry);
      map.set(slot.day_of_week, existing);
    }
    return map;
  }, [availabilitySlots]);

  const hasAvailability = availabilityMap.size > 0;

  // slotPropGetter: dim slots outside availability windows
  const slotPropGetter = useCallback((date: Date) => {
    if (!hasAvailability) return {};
    const day = date.getDay();
    const minutes = date.getHours() * 60 + date.getMinutes();
    const windows = availabilityMap.get(day);
    const isAvailable = windows && windows.some(w => minutes >= w.startMinutes && minutes < w.endMinutes);
    if (isAvailable) {
      return { className: 'rbc-slot-available' };
    }
    return {};
  }, [availabilityMap, hasAvailability]);

  // Fetch external calendar blocks (Google Calendar busy periods)
  const { backgroundEvents: externalBlocks, refetch: refetchBlocks, deleteBlock } = useStaffCalendarBlocks({
    staffTimezone: authStaffTimezone,
    enabled: true,
  });
  
  // Debug: log when appointments change
  console.log('[RBCCalendar] Render with appointments count:', appointments?.length ?? 0);
  
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<{ id: string; summary: string; source: string } | null>(null);
  const [prefilledDate, setPrefilledDate] = useState<string>('');
  const [prefilledTime, setPrefilledTime] = useState<string>('');
  
  // Working hours state with localStorage persistence
  const [workingHoursStart, setWorkingHoursStart] = useState(() => loadWorkingHours().start);
  const [workingHoursEnd, setWorkingHoursEnd] = useState(() => loadWorkingHours().end);

  const handleWorkingHoursChange = useCallback((start: number, end: number) => {
    setWorkingHoursStart(start);
    setWorkingHoursEnd(end);
    saveWorkingHours(start, end);
  }, []);

  const handleSettingsChanged = useCallback(() => {
    refetchAvailability();
    refetchBlocks();
  }, [refetchAvailability, refetchBlocks]);

  // Plain local Date objects for min/max
  const minTime = useMemo(() => createLocalTime(workingHoursStart, 0), [workingHoursStart]);
  const maxTime = useMemo(() => createLocalTime(workingHoursEnd, 0), [workingHoursEnd]);
  const scrollToTime = useMemo(() => createLocalTime(workingHoursStart, 0), [workingHoursStart]);

  // Timezone mismatch indicator (uses auth-based timezone, not appointment-dependent)
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzMismatch = authStaffTimezone !== browserTimezone;

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
        authStaffTimezone,
        firstEvent: {
          displayTime: firstAppt.display_time,
          calendarStartHour: first.start.getHours(),
          calendarStartMinute: first.start.getMinutes(),
        },
      });
    }

    return mapped;
  }, [appointments, authStaffTimezone]);

  // Dynamic event styling based on status
  const eventStyleGetter = useCallback((event: any) => {
    // External calendar blocks get distinct styling
    if (event.resource?.isExternalBlock) {
      return {
        style: {
          backgroundColor: 'hsl(var(--muted))',
          borderRadius: '4px',
          opacity: 0.7,
          color: 'hsl(var(--muted-foreground))',
          border: '1px dashed hsl(var(--border))',
          display: 'block',
          cursor: 'default',
        },
      };
    }

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

  // Handle event click — show block details for blocks, appointment details otherwise
  const handleSelectEvent = useCallback((event: any) => {
    if (event.resource?.isExternalBlock) {
      const blockId = String(event.id).replace('block-', '');
      setSelectedBlock({
        id: blockId,
        summary: event.title || 'Busy',
        source: event.resource.source || '',
      });
      return;
    }
    setSelectedAppointmentId(event.id);
    setViewDialogOpen(true);
  }, []);

  // Handle slot selection
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setPrefilledDate(DateTime.fromJSDate(slotInfo.start).toFormat('yyyy-MM-dd'));
    const hh = String(slotInfo.start.getHours()).padStart(2, '0');
    const mm = String(slotInfo.start.getMinutes()).padStart(2, '0');
    setPrefilledTime(`${hh}:${mm}`);
    setCreateDialogOpen(true);
  }, []);

  // Derive selected appointment from the already-loaded hook data (no raw query needed)
  const selectedAppointment = selectedAppointmentId ? getAppointmentById(selectedAppointmentId) : undefined;

  // Handle appointment update via the hook (includes Google Calendar sync)
  const handleUpdateAppointment = async (appointmentId: string, updates: any) => {
    await updateAppointment(appointmentId, updates);
    setViewDialogOpen(false);
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
          <div className="flex items-center gap-2">
            {hasAvailability && (
              <span className="text-xs text-muted-foreground px-2 py-1 rounded border border-border">
                Highlighted = available hours
              </span>
            )}
            {tzMismatch && (
              <span className="text-xs text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-1 rounded border border-yellow-300 dark:border-yellow-700">
                Showing times in {authStaffTimezone}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setBlockDialogOpen(true)}
            >
              <Ban className="h-4 w-4" />
              Block Time
            </Button>
            {showCreateButton && (
              <CreateAppointmentDialog
                trigger={
                  <Button className="flex items-center gap-2" size="sm">
                    <Plus className="h-4 w-4" />
                    Create Appointment
                  </Button>
                }
                onAppointmentCreated={refetch}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="calendar-container h-[600px]">
          <Calendar
            localizer={localizer}
            getNow={() => serverNow}
            events={[...events, ...externalBlocks]}
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
            slotPropGetter={slotPropGetter}
            components={{
              toolbar: (props) => (
                <CalendarToolbar
                  {...props}
                  onSettingsClick={() => setSettingsPanelOpen(true)}
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
        prefilledTime={prefilledTime}
        trigger={null}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onAppointmentCreated={refetch}
      />

      {/* Block Time Dialog */}
      <BlockTimeDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        prefilledDate={prefilledDate}
        onBlockCreated={refetchBlocks}
      />

      {/* Manual Block Details Dialog */}
      {selectedBlock && (
        <Dialog open={!!selectedBlock} onOpenChange={() => setSelectedBlock(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{selectedBlock.summary}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {selectedBlock.source === 'manual' ? 'Manually blocked time' : `Synced from ${selectedBlock.source}`}
            </p>
            {selectedBlock.source === 'manual' && (
              <DialogFooter>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await deleteBlock(selectedBlock.id);
                    setSelectedBlock(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Block
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}
      {/* Calendar Settings Panel */}
      <CalendarSettingsPanel
        open={settingsPanelOpen}
        onOpenChange={setSettingsPanelOpen}
        workingHoursStart={workingHoursStart}
        workingHoursEnd={workingHoursEnd}
        onWorkingHoursChange={handleWorkingHoursChange}
        onSettingsChanged={handleSettingsChanged}
      />
    </Card>
  );
}
