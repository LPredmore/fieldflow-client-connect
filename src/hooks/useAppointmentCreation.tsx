import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { getDBTimezoneEnum } from '@/lib/appointmentTimezone';
import { useFreshStaffTimezone } from './useStaffTimezone';
import { useDefaultLocation } from './useDefaultLocation';

export interface CreateAppointmentInput {
  client_id: string;
  service_id: string;
  date: string; // YYYY-MM-DD (user's local date)
  time: string; // HH:mm (user's local time)
  duration_minutes: number;
  is_telehealth?: boolean;
  location_name?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
}

/**
 * Hook for creating single appointments in the appointments table.
 * 
 * Time Model (server-authoritative):
 * 1. User selects date/time in their LOCAL timezone via form inputs
 * 2. This hook calls PostgreSQL convert_local_to_utc RPC for conversion
 * 3. Database stores UTC timestamps (start_at, end_at as timestamptz)
 * 4. time_zone column stores creator's timezone as metadata
 */
export function useAppointmentCreation() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const { timezone: staffTimezone, isLoading: timezoneLoading } = useFreshStaffTimezone();
  const { defaultLocation } = useDefaultLocation();

  // Get the current staff_id from auth context
  const staffId = user?.staffAttributes?.staffData?.id;

  /**
   * Creates a Daily.co video room for the appointment
   */
  const createVideoRoom = async (appointmentId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('create-daily-room', {
        body: { appointmentId },
      });

      if (error) {
        console.error('Error creating video room:', error);
        return null;
      }

      return data?.videoroom_url || null;
    } catch (err) {
      console.error('Failed to create video room:', err);
      return null;
    }
  };

  const createAppointment = async (data: CreateAppointmentInput) => {
    if (timezoneLoading || !staffTimezone) {
      throw new Error('Timezone not yet loaded. Please wait a moment and try again.');
    }
    if (!user || !tenantId || !staffId) {
      throw new Error('User not authenticated or staff ID not found');
    }

    // Convert local date/time to UTC via PostgreSQL RPC (server-authoritative)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('convert_local_to_utc', {
      p_date: data.date,
      p_time: data.time,
      p_timezone: staffTimezone,
    });

    if (rpcError || !rpcResult) {
      const msg = rpcError?.message || 'Failed to convert timezone';
      console.error('[useAppointmentCreation] RPC error:', msg);
      toast({ variant: 'destructive', title: 'Timezone conversion failed', description: msg });
      throw new Error(msg);
    }

    const startUTC = new Date(rpcResult);
    const endUTC = new Date(startUTC.getTime() + data.duration_minutes * 60 * 1000);
    const dbTimezone = getDBTimezoneEnum(staffTimezone);

    // Determine location_name based on telehealth status
    const isTelehealth = data.is_telehealth ?? false;
    const effectiveLocationName = isTelehealth
      ? 'Telehealth'
      : (data.location_name || defaultLocation?.name || null);

    const appointmentData = {
      tenant_id: tenantId,
      client_id: data.client_id,
      staff_id: staffId,
      service_id: data.service_id,
      start_at: startUTC.toISOString(),
      end_at: endUTC.toISOString(),
      status: data.status || 'scheduled',
      is_telehealth: isTelehealth,
      location_id: defaultLocation?.id || null,
      location_name: effectiveLocationName,
      time_zone: dbTimezone,
      created_by_profile_id: user.id,
      series_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select()
      .single();

    if (error) {
      console.error('Error creating appointment:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create appointment',
        description: error.message,
      });
      throw error;
    }

    // If telehealth, create Daily.co video room
    let videoRoomUrl: string | null = null;
    if (data.is_telehealth && appointment) {
      videoRoomUrl = await createVideoRoom(appointment.id);
      if (videoRoomUrl) {
        toast({
          title: 'Telehealth appointment created',
          description: 'Video room has been set up for this appointment',
        });
      } else {
        toast({
          title: 'Appointment created',
          description: 'Video room setup is pending - it will be available shortly',
        });
      }
    } else {
      toast({
        title: 'Appointment created',
        description: 'Your appointment has been scheduled successfully',
      });
    }

    // Fire-and-forget Google Calendar sync
    if (appointment) {
      supabase.functions.invoke('google-calendar-sync-appointment', {
        body: { appointment_id: appointment.id, action: 'create' },
      }).then(({ data }) => {
        if (data?.synced) {
          console.log('[CalendarSync] Appointment synced to Google Calendar');
        }
      }).catch((err) => {
        console.warn('[CalendarSync] Sync failed (non-blocking):', err);
      });
    }

    return { ...appointment, videoroom_url: videoRoomUrl };
  };

  return {
    createAppointment,
    createVideoRoom,
    staffId,
    timezoneLoading,
  };
}
