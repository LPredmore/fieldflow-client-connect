import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserTimezone } from './useUserTimezone';
import { useToast } from '@/hooks/use-toast';
import { combineDateTimeToUTC } from '@/lib/timezoneUtils';
import { rrulestr } from 'rrule';
import { addMinutes } from 'date-fns';

export interface CreateOneTimeAppointmentInput {
  title: string;
  customer_id: string;
  service_id?: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  duration_minutes: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to_user_id?: string;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

export interface CreateRecurringAppointmentInput extends CreateOneTimeAppointmentInput {
  rrule: string;
  maxOccurrences?: number;
}

export function useAppointmentCreation() {
  const { user, tenantId } = useAuth();
  const userTimezone = useUserTimezone();
  const { toast } = useToast();

  const createOneTimeAppointment = async (data: CreateOneTimeAppointmentInput) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    // Convert local time to UTC
    const utcStart = combineDateTimeToUTC(data.date, data.time, userTimezone);
    const utcEnd = addMinutes(utcStart, data.duration_minutes);

    const appointmentData = {
      tenant_id: tenantId,
      customer_id: data.customer_id,
      service_id: data.service_id || null,
      title: data.title,
      description: data.description || null,
      start_at: utcStart.toISOString(),
      end_at: utcEnd.toISOString(),
      duration: data.duration_minutes,
      status: data.status || 'scheduled',
      priority: data.priority || 'medium',
      is_recurring: false,
      timezone: userTimezone,
      created_by_user_id: user.id,
      assigned_to_user_id: data.assigned_to_user_id || user.id, // Auto-assign to creator if not specified
      original_start_at: utcStart.toISOString(),
    };

    const { data: appointment, error } = await supabase
      .from('appointment_occurrences')
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

  const createRecurringAppointments = async (data: CreateRecurringAppointmentInput) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    // Parse RRule and generate occurrences
    const startDate = new Date(`${data.date}T${data.time}`);
    const rule = rrulestr(data.rrule, { dtstart: startDate });
    const maxOccurrences = data.maxOccurrences || 365; // Default to 1 year
    const occurrences = rule.all().slice(0, maxOccurrences);

    if (occurrences.length === 0) {
      throw new Error('RRule generated no occurrences');
    }

    // Generate group ID for this recurring series
    const groupId = crypto.randomUUID();

    // Create all occurrence instances
    const instances = occurrences.map(occurrenceDate => {
      const utcStart = combineDateTimeToUTC(
        occurrenceDate.toISOString().split('T')[0],
        data.time,
        userTimezone
      );
      const utcEnd = addMinutes(utcStart, data.duration_minutes);

      return {
        tenant_id: tenantId,
        customer_id: data.customer_id,
        service_id: data.service_id || null,
        title: data.title,
        description: data.description || null,
        start_at: utcStart.toISOString(),
        end_at: utcEnd.toISOString(),
        duration: data.duration_minutes,
        status: data.status || 'scheduled',
        priority: data.priority || 'medium',
        is_recurring: true,
        recurrence_group_id: groupId,
        recurrence_rule: data.rrule,
        recurrence_edit_mode: 'none',
        timezone: userTimezone,
        original_start_at: utcStart.toISOString(),
        created_by_user_id: user.id,
        assigned_to_user_id: data.assigned_to_user_id || user.id, // Auto-assign to creator if not specified
      };
    });

    const { data: appointments, error } = await supabase
      .from('appointment_occurrences')
      .insert(instances)
      .select();

    if (error) {
      console.error('Error creating recurring appointments:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create recurring appointments',
        description: error.message,
      });
      throw error;
    }

    toast({
      title: 'Recurring appointments created',
      description: `Successfully created ${appointments.length} appointment instances`,
    });

    return { appointments, groupId };
  };

  return {
    createOneTimeAppointment,
    createRecurringAppointments,
  };
}
