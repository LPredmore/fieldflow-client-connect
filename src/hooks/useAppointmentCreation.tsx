import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { localToUTC, calculateEndUTC, getDBTimezoneEnum } from '@/lib/appointmentTimezone';
import { useStaffTimezone } from './useStaffTimezone';
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
 * Time Model:
 * 1. User selects date/time in their LOCAL timezone via form inputs
 * 2. This hook converts local → UTC before saving to database
 * 3. Database stores UTC timestamps (start_at, end_at as timestamptz)
 * 4. time_zone column stores creator's timezone as metadata
 * 
 * Telehealth Integration:
 * - If is_telehealth is true, creates a Daily.co video room after appointment insert
 * - Video room URL is stored in appointments.videoroom_url
 */
export function useAppointmentCreation() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const staffTimezone = useStaffTimezone();
  const { defaultLocation } = useDefaultLocation();

  // Get the current staff_id from auth context
  const staffId = user?.staffAttributes?.staffData?.id;

  /**
   * Creates a Daily.co video room for the appointment
   */
  const createVideoRoom = async (appointmentId: string): Promise<string | null> => {
    try {
      console.log('Creating Daily.co room for appointment:', appointmentId);
      
      const { data, error } = await supabase.functions.invoke('create-daily-room', {
        body: { appointmentId },
      });

      if (error) {
        console.error('Error creating video room:', error);
        return null;
      }

      if (data?.videoroom_url) {
        console.log('Video room created:', data.videoroom_url);
        return data.videoroom_url;
      }

      return null;
    } catch (err) {
      console.error('Failed to create video room:', err);
      return null;
    }
  };

  const createAppointment = async (data: CreateAppointmentInput) => {
    if (!user || !tenantId || !staffId) {
      throw new Error('User not authenticated or staff ID not found');
    }

    // Log input data BEFORE conversion for debugging
    console.log('[useAppointmentCreation] Input data:', {
      date: data.date,
      time: data.time,
      staffTimezone,
      duration_minutes: data.duration_minutes
    });

    // Convert local date/time to UTC for database storage
    // User selected time in their configured timezone (staffTimezone)
    // localToUTC interprets the input as local time and converts to UTC
    const startUTC = localToUTC(data.date, data.time, staffTimezone);
    const endUTC = calculateEndUTC(startUTC, data.duration_minutes);
    
    // Get database enum value for timezone metadata
    const dbTimezone = getDBTimezoneEnum(staffTimezone);
    
    // Log conversion results for verification
    console.log('[useAppointmentCreation] Conversion result:', {
      inputLocal: `${data.date} ${data.time} in ${staffTimezone}`,
      outputUTC: startUTC,
      endUTC: endUTC,
      dbTimezone
    });

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
      start_at: startUTC,  // UTC timestamp
      end_at: endUTC,      // UTC timestamp
      status: data.status || 'scheduled',
      is_telehealth: isTelehealth,
      location_id: defaultLocation?.id || null, // Default practice location
      location_name: effectiveLocationName,
      time_zone: dbTimezone, // Creator's timezone (metadata only)
      created_by_profile_id: user.id,
      series_id: null, // Single appointment, not part of a series
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

    return { ...appointment, videoroom_url: videoRoomUrl };
  };

  return {
    createAppointment,
    createVideoRoom,
    staffId,
  };
}
