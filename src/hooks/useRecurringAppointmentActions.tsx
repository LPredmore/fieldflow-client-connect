import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { syncAppointmentToGoogle, syncMultipleAppointmentsToGoogle } from '@/lib/googleCalendarSync';

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

  const editSingleOccurrence = useCallback(async (
    appointmentId: string,
    updates: AppointmentUpdates
  ) => {
    if (!tenantId) throw new Error('Not authenticated');

    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('series_id, start_at')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!appointment) throw new Error('Appointment not found');

    const { error: updateError } = await supabase
      .from('appointments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    // Record exception if part of a series
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
      }
    }

    // Fire-and-forget Google Calendar sync
    syncAppointmentToGoogle(appointmentId, 'update');

    toast({
      title: 'Appointment updated',
      description: 'This occurrence has been updated.',
    });

    return { success: true };
  }, [tenantId, toast]);

  const editThisAndFuture = useCallback(async (
    appointmentId: string,
    updates: AppointmentUpdates
  ) => {
    if (!tenantId) throw new Error('Not authenticated');

    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('series_id, start_at')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!appointment) throw new Error('Appointment not found');
    if (!appointment.series_id) {
      return editSingleOccurrence(appointmentId, updates);
    }

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

    const { data: updatedAppointments, error: updateError } = await supabase
      .from('appointments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('series_id', appointment.series_id)
      .eq('tenant_id', tenantId)
      .gte('start_at', appointment.start_at)
      .select('id');

    if (updateError) throw updateError;

    // Fire-and-forget sync each updated appointment
    if (updatedAppointments) {
      syncMultipleAppointmentsToGoogle(
        updatedAppointments.map(a => a.id),
        'update'
      );
    }

    toast({
      title: 'Appointments updated',
      description: `Updated ${updatedAppointments?.length || 0} appointment(s).`,
    });

    return { success: true, count: updatedAppointments?.length || 0 };
  }, [tenantId, toast, editSingleOccurrence]);

  const deleteSingleOccurrence = useCallback(async (appointmentId: string) => {
    if (!tenantId) throw new Error('Not authenticated');

    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('series_id, start_at')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!appointment) throw new Error('Appointment not found');

    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

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

    // Fire-and-forget Google Calendar sync
    syncAppointmentToGoogle(appointmentId, 'delete');

    toast({
      title: 'Appointment cancelled',
      description: 'This appointment has been cancelled.',
    });

    return { success: true };
  }, [tenantId, toast]);

  const deleteThisAndFuture = useCallback(async (appointmentId: string) => {
    if (!tenantId) throw new Error('Not authenticated');

    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('series_id, start_at')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!appointment) throw new Error('Appointment not found');

    if (!appointment.series_id) {
      return deleteSingleOccurrence(appointmentId);
    }

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

    const { data: cancelledAppointments, error: cancelError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('series_id', appointment.series_id)
      .eq('tenant_id', tenantId)
      .gte('start_at', appointment.start_at)
      .select('id');

    if (cancelError) throw cancelError;

    // Fire-and-forget sync each cancelled appointment
    if (cancelledAppointments) {
      syncMultipleAppointmentsToGoogle(
        cancelledAppointments.map(a => a.id),
        'delete'
      );
    }

    toast({
      title: 'Appointments cancelled',
      description: `Cancelled ${cancelledAppointments?.length || 0} appointment(s).`,
    });

    return { success: true, count: cancelledAppointments?.length || 0 };
  }, [tenantId, toast, deleteSingleOccurrence]);

  const deleteEntireSeries = useCallback(async (seriesId: string) => {
    if (!tenantId) throw new Error('Not authenticated');

    const { error: seriesError } = await supabase
      .from('appointment_series')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', seriesId)
      .eq('tenant_id', tenantId);

    if (seriesError) throw seriesError;

    const { data: cancelledAppointments, error: cancelError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('series_id', seriesId)
      .eq('tenant_id', tenantId)
      .select('id');

    if (cancelError) throw cancelError;

    // Fire-and-forget sync each cancelled appointment
    if (cancelledAppointments) {
      syncMultipleAppointmentsToGoogle(
        cancelledAppointments.map(a => a.id),
        'delete'
      );
    }

    toast({
      title: 'Series cancelled',
      description: `Cancelled ${cancelledAppointments?.length || 0} appointment(s) in the series.`,
    });

    return { success: true, count: cancelledAppointments?.length || 0 };
  }, [tenantId, toast]);

  const updateAppointment = useCallback(async (
    appointmentId: string,
    updates: AppointmentUpdates
  ) => {
    if (!tenantId) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('appointments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Fire-and-forget Google Calendar sync
    syncAppointmentToGoogle(appointmentId, 'update');

    toast({
      title: 'Appointment updated',
      description: 'Changes have been saved.',
    });

    return { success: true };
  }, [tenantId, toast]);

  const deleteAppointment = useCallback(async (appointmentId: string) => {
    if (!tenantId) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Fire-and-forget Google Calendar sync
    syncAppointmentToGoogle(appointmentId, 'delete');

    toast({
      title: 'Appointment cancelled',
      description: 'The appointment has been cancelled.',
    });

    return { success: true };
  }, [tenantId, toast]);

  return {
    editSingleOccurrence,
    editThisAndFuture,
    deleteSingleOccurrence,
    deleteThisAndFuture,
    deleteEntireSeries,
    updateAppointment,
    deleteAppointment,
  };
}
