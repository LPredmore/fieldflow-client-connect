import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { localToUTC, calculateEndUTC, getDBTimezoneEnum, getBrowserTimezone } from '@/lib/appointmentTimezone';

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
 */
export function useAppointmentCreation() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();

  // Get the current staff_id from auth context
  const staffId = user?.staffAttributes?.staffData?.id;

  const createAppointment = async (data: CreateAppointmentInput) => {
    if (!user || !tenantId || !staffId) {
      throw new Error('User not authenticated or staff ID not found');
    }

    // Get browser timezone for conversion and metadata
    const browserTimezone = getBrowserTimezone();

    // Convert local date/time to UTC for database storage
    // User selected "10:00 AM on 2025-12-05" in their local timezone
    // This becomes the UTC instant to store
    const startUTC = localToUTC(data.date, data.time, browserTimezone);
    const endUTC = calculateEndUTC(startUTC, data.duration_minutes);
    
    // Get database enum value for timezone metadata
    const dbTimezone = getDBTimezoneEnum(browserTimezone);

    const appointmentData = {
      tenant_id: tenantId,
      client_id: data.client_id,
      staff_id: staffId,
      service_id: data.service_id,
      start_at: startUTC,  // UTC timestamp
      end_at: endUTC,      // UTC timestamp
      status: data.status || 'scheduled',
      is_telehealth: data.is_telehealth ?? false,
      location_name: data.location_name || null,
      time_zone: dbTimezone, // Creator's timezone (metadata only)
      created_by_profile_id: user.id,
      series_id: null, // Single appointment, not part of a series
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

    toast({
      title: 'Appointment created',
      description: 'Your appointment has been scheduled successfully',
    });

    return appointment;
  };

  return {
    createAppointment,
    staffId,
  };
}
