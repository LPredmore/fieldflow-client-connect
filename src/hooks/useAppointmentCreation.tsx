import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserTimezone } from './useUserTimezone';
import { useToast } from '@/hooks/use-toast';
import { combineDateTimeToUTC } from '@/lib/timezoneUtils';
import { addMinutes } from 'date-fns';

export interface CreateAppointmentInput {
  client_id: string;
  service_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  duration_minutes: number;
  is_telehealth?: boolean;
  location_name?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
}

/**
 * Hook for creating single appointments in the appointments table.
 * Uses correct schema columns: client_id, staff_id, service_id, etc.
 */
export function useAppointmentCreation() {
  const { user, tenantId } = useAuth();
  const userTimezone = useUserTimezone();
  const { toast } = useToast();

  // Get the current staff_id from auth context
  const staffId = user?.staffAttributes?.staffData?.id;

  const createAppointment = async (data: CreateAppointmentInput) => {
    if (!user || !tenantId || !staffId) {
      throw new Error('User not authenticated or staff ID not found');
    }

    // Convert local time to UTC
    const utcStart = combineDateTimeToUTC(data.date, data.time, userTimezone);
    const utcEnd = addMinutes(utcStart, data.duration_minutes);

    // Map time_zone string to the database enum value
    // The database uses time_zones enum
    const timeZoneMapping: Record<string, string> = {
      'America/New_York': 'America/New_York',
      'America/Chicago': 'America/Chicago',
      'America/Denver': 'America/Denver',
      'America/Los_Angeles': 'America/Los_Angeles',
      'America/Phoenix': 'America/Phoenix',
      'America/Anchorage': 'America/Anchorage',
      'Pacific/Honolulu': 'Pacific/Honolulu',
    };
    
    const dbTimezone = timeZoneMapping[userTimezone] || 'America/New_York';

    const appointmentData = {
      tenant_id: tenantId,
      client_id: data.client_id,
      staff_id: staffId,
      service_id: data.service_id,
      start_at: utcStart.toISOString(),
      end_at: utcEnd.toISOString(),
      status: data.status || 'scheduled',
      is_telehealth: data.is_telehealth ?? false,
      location_name: data.location_name || null,
      time_zone: dbTimezone,
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
