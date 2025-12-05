import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export function useRecurringAppointmentEdit() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();

  /**
   * Edit a single occurrence without affecting the rest of the series
   */
  const editSingleOccurrence = async (
    occurrenceId: string,
    updates: Record<string, any>
  ) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('appointment_occurrences')
      .update({
        ...updates,
        recurrence_edit_mode: 'this_only',
        updated_at: new Date().toISOString(),
      })
      .eq('id', occurrenceId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Error editing occurrence:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to edit appointment',
        description: error.message,
      });
      throw error;
    }

    toast({
      title: 'Appointment updated',
      description: 'This occurrence has been updated',
    });

    return data;
  };

  /**
   * Edit this occurrence and all future occurrences in the series
   */
  const editThisAndFutureOccurrences = async (
    occurrenceId: string,
    updates: Record<string, any>
  ) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    // First, get the occurrence to find its group and start time
    const { data: occurrence, error: fetchError } = await supabase
      .from('appointment_occurrences')
      .select('recurrence_group_id, start_at, original_start_at')
      .eq('id', occurrenceId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !occurrence) {
      throw new Error('Occurrence not found');
    }

    if (!occurrence.recurrence_group_id) {
      throw new Error('This is not a recurring appointment');
    }

    // Update all future occurrences in the group that haven't been individually edited
    const { data, error } = await supabase
      .from('appointment_occurrences')
      .update({
        ...updates,
        recurrence_edit_mode: 'this_and_future',
        updated_at: new Date().toISOString(),
      })
      .eq('recurrence_group_id', occurrence.recurrence_group_id)
      .eq('tenant_id', tenantId)
      .gte('start_at', occurrence.start_at)
      .eq('recurrence_edit_mode', 'none') // Don't override individually edited instances
      .select();

    if (error) {
      console.error('Error editing future occurrences:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to edit appointments',
        description: error.message,
      });
      throw error;
    }

    toast({
      title: 'Appointments updated',
      description: `Updated ${data.length} future occurrence(s)`,
    });

    return data;
  };

  /**
   * Delete a single occurrence
   */
  const deleteOccurrence = async (occurrenceId: string) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('appointment_occurrences')
      .delete()
      .eq('id', occurrenceId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error deleting occurrence:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to delete appointment',
        description: error.message,
      });
      throw error;
    }

    toast({
      title: 'Appointment deleted',
      description: 'The appointment has been removed',
    });
  };

  /**
   * Delete this occurrence and all future occurrences
   */
  const deleteThisAndFutureOccurrences = async (occurrenceId: string) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    // Get occurrence details
    const { data: occurrence, error: fetchError } = await supabase
      .from('appointment_occurrences')
      .select('recurrence_group_id, start_at')
      .eq('id', occurrenceId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !occurrence) {
      throw new Error('Occurrence not found');
    }

    if (!occurrence.recurrence_group_id) {
      throw new Error('This is not a recurring appointment');
    }

    // Delete all future occurrences in the group
    const { error } = await supabase
      .from('appointment_occurrences')
      .delete()
      .eq('recurrence_group_id', occurrence.recurrence_group_id)
      .eq('tenant_id', tenantId)
      .gte('start_at', occurrence.start_at);

    if (error) {
      console.error('Error deleting future occurrences:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to delete appointments',
        description: error.message,
      });
      throw error;
    }

    toast({
      title: 'Appointments deleted',
      description: 'All future occurrences have been removed',
    });
  };

  return {
    editSingleOccurrence,
    editThisAndFutureOccurrences,
    deleteOccurrence,
    deleteThisAndFutureOccurrences,
  };
}
