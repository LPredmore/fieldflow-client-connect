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

export function RBCCalendar() {
  const { appointments, loading, refetch } = useCalendarAppointments();
  const { tenantId } = useAuth();
  
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState<string>('');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

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
              toolbar: CalendarToolbar,
              event: AppointmentEvent,
            }}
            min={new Date(new Date().getFullYear(), 0, 1, 6, 0, 0)}
            max={new Date(new Date().getFullYear(), 0, 1, 22, 0, 0)}
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
