import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export type EditScope = 'this_only' | 'this_and_future';
export type DeleteScope = 'this_only' | 'this_and_future' | 'entire_series';

interface AppointmentUpdates {
  start_at?: string;
  end_at?: string;
  client_id?: string;
  staff_id?: string;
  service_id?: string;
  is_telehealth?: boolean;
  location_name?: string | null;
  status?: 'scheduled' | 'completed' | 'cancelled';
}

export function useRecurringAppointmentActions() {
  const { tenantId } = useAuth();
  const { toast } = useToast();

  /**
   * Edit a single occurrence - updates just this appointment and records an exception
   */
  const editSingleOccurrence = useCallback(async (
    appointmentId: string,
    updates: AppointmentUpdates
  ) => {
    if (!tenantId) throw new Error('Not authenticated');

    // Get the appointment to find series info
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('series_id, start_at')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!appointment) throw new Error('Appointment not found');

    // Update the appointment
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    // If this is part of a series, record an exception
    if (appointment.series_id) {
      const { error: exceptionError } = await supabase
        .from('appointment_exceptions')
        .insert({
          tenant_id: tenantId,
          series_id: appointment.series_id,
          original_start_at: appointment.start_at,
          change_type: 'rescheduled',
          replacement_appointment_id: appointmentId,
          notes: 'Single occurrence edited',
        });

      if (exceptionError) {
        console.error('Failed to record exception:', exceptionError);
        // Don't throw - the appointment was updated successfully
      }
    }

    toast({
      title: 'Appointment updated',
      description: 'This occurrence has been updated.',
    });

    return { success: true };
  }, [tenantId, toast]);

  /**
   * Edit this occurrence and all future occurrences
   * This ends the current series and updates all future appointments
   */
  const editThisAndFuture = useCallback(async (
    appointmentId: string,
    updates: AppointmentUpdates
  ) => {
    if (!tenantId) throw new Error('Not authenticated');

    // Get the appointment details
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('series_id, start_at')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!appointment) throw new Error('Appointment not found');
    if (!appointment.series_id) {
      // Not a series appointment, just update normally
      return editSingleOccurrence(appointmentId, updates);
    }

    // Update the series end date to just before this occurrence
    const previousDay = new Date(appointment.start_at);
    previousDay.setDate(previousDay.getDate() - 1);
    
    const { error: seriesError } = await supabase
      .from('appointment_series')
      .update({
        series_end_date: previousDay.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointment.series_id)
      .eq('tenant_id', tenantId);

    if (seriesError) throw seriesError;

    // Update all future appointments in this series
    const { data: updatedAppointments, error: updateError } = await supabase
      .from('appointments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('series_id', appointment.series_id)
      .eq('tenant_id', tenantId)
      .gte('start_at', appointment.start_at)
      .select();

    if (updateError) throw updateError;

    toast({
      title: 'Appointments updated',
      description: `Updated ${updatedAppointments?.length || 0} appointment(s).`,
    });

    return { success: true, count: updatedAppointments?.length || 0 };
  }, [tenantId, toast, editSingleOccurrence]);

  /**
   * Delete a single occurrence - marks as cancelled and records exception
   */
  const deleteSingleOccurrence = useCallback(async (appointmentId: string) => {
    if (!tenantId) throw new Error('Not authenticated');

    // Get the appointment details
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('series_id, start_at')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!appointment) throw new Error('Appointment not found');

    // For single appointments or series occurrences, mark as cancelled
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    // If part of a series, record the exception
    if (appointment.series_id) {
      const { error: exceptionError } = await supabase
        .from('appointment_exceptions')
        .insert({
          tenant_id: tenantId,
          series_id: appointment.series_id,
          original_start_at: appointment.start_at,
          change_type: 'cancelled',
          notes: 'Single occurrence cancelled',
        });

      if (exceptionError) {
        console.error('Failed to record exception:', exceptionError);
      }
    }

    toast({
      title: 'Appointment cancelled',
      description: 'This appointment has been cancelled.',
    });

    return { success: true };
  }, [tenantId, toast]);

  /**
   * Delete this and all future occurrences in the series
   */
  const deleteThisAndFuture = useCallback(async (appointmentId: string) => {
    if (!tenantId) throw new Error('Not authenticated');

    // Get the appointment details
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('series_id, start_at')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!appointment) throw new Error('Appointment not found');

    if (!appointment.series_id) {
      // Not a series, just cancel this one
      return deleteSingleOccurrence(appointmentId);
    }

    // Update series end date
    const previousDay = new Date(appointment.start_at);
    previousDay.setDate(previousDay.getDate() - 1);
    
    const { error: seriesError } = await supabase
      .from('appointment_series')
      .update({
        series_end_date: previousDay.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointment.series_id)
      .eq('tenant_id', tenantId);

    if (seriesError) throw seriesError;

    // Cancel all future appointments in the series
    const { data: cancelledAppointments, error: cancelError } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('series_id', appointment.series_id)
      .eq('tenant_id', tenantId)
      .gte('start_at', appointment.start_at)
      .select();

    if (cancelError) throw cancelError;

    toast({
      title: 'Appointments cancelled',
      description: `Cancelled ${cancelledAppointments?.length || 0} appointment(s).`,
    });

    return { success: true, count: cancelledAppointments?.length || 0 };
  }, [tenantId, toast, deleteSingleOccurrence]);

  /**
   * Delete entire series - cancels all appointments and deactivates series
   */
  const deleteEntireSeries = useCallback(async (seriesId: string) => {
    if (!tenantId) throw new Error('Not authenticated');

    // Deactivate the series
    const { error: seriesError } = await supabase
      .from('appointment_series')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', seriesId)
      .eq('tenant_id', tenantId);

    if (seriesError) throw seriesError;

    // Cancel all appointments in the series
    const { data: cancelledAppointments, error: cancelError } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('series_id', seriesId)
      .eq('tenant_id', tenantId)
      .select();

    if (cancelError) throw cancelError;

    toast({
      title: 'Series cancelled',
      description: `Cancelled ${cancelledAppointments?.length || 0} appointment(s) in the series.`,
    });

    return { success: true, count: cancelledAppointments?.length || 0 };
  }, [tenantId, toast]);

  /**
   * Update a single (non-series) appointment
   */
  const updateAppointment = useCallback(async (
    appointmentId: string,
    updates: AppointmentUpdates
  ) => {
    if (!tenantId) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('appointments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    toast({
      title: 'Appointment updated',
      description: 'Changes have been saved.',
    });

    return { success: true };
  }, [tenantId, toast]);

  /**
   * Delete a single (non-series) appointment
   */
  const deleteAppointment = useCallback(async (appointmentId: string) => {
    if (!tenantId) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    toast({
      title: 'Appointment cancelled',
      description: 'The appointment has been cancelled.',
    });

    return { success: true };
  }, [tenantId, toast]);

  return {
    // Series-aware actions
    editSingleOccurrence,
    editThisAndFuture,
    deleteSingleOccurrence,
    deleteThisAndFuture,
    deleteEntireSeries,
    // Simple actions for non-series appointments
    updateAppointment,
    deleteAppointment,
  };
}
