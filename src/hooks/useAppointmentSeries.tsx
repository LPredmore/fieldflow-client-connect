import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { useStaffTimezone } from './useStaffTimezone';
import { localToUTC, getDBTimezoneEnum } from '@/lib/appointmentTimezone';

export interface AppointmentSeries {
  id: string;
  tenant_id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  rrule: string;
  start_at: string;
  duration_minutes: number;
  time_zone: string;
  series_end_date: string | null;
  max_occurrences: number | null;
  is_active: boolean;
  notes: string | null;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentSeriesInput {
  client_id: string;
  service_id: string;
  start_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  duration_minutes: number;
  rrule: string;
  series_end_date?: string | null;
  max_occurrences?: number | null;
  notes?: string;
  is_telehealth?: boolean; // Whether appointments in this series are telehealth
}

/**
 * Hook to manage recurring appointment series.
 * Uses the appointment_series table with correct schema columns.
 */
/**
 * Hook to manage recurring appointment series.
 * 
 * Time Model:
 * 1. User selects start date/time in their LOCAL timezone
 * 2. This hook converts local → UTC before saving to database
 * 3. Database stores UTC timestamps (start_at as timestamptz)
 * 4. time_zone column stores creator's timezone as metadata
 */
export function useAppointmentSeries() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const staffTimezone = useStaffTimezone();

  // Get the current staff_id from auth context
  const staffId = user?.staffAttributes?.staffData?.id;

  // Query appointment series
  const {
    data: series,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<AppointmentSeries>({
    table: 'appointment_series',
    filters: {
      tenant_id: 'auto',
    },
    orderBy: { column: 'created_at', ascending: false },
  });

  // Create a new appointment series
  const createSeries = async (input: CreateAppointmentSeriesInput) => {
    if (!user || !tenantId || !staffId) {
      throw new Error('User not authenticated or staff ID not found');
    }

    // Use staff timezone for conversion and metadata (NOT browser timezone)
    // This ensures recurring appointments are created in the staff's preferred timezone

    // Convert local start time to UTC for database storage using staff timezone
    const startUTC = localToUTC(input.start_date, input.start_time, staffTimezone);
    
    // Get database enum value for timezone metadata
    const dbTimezone = getDBTimezoneEnum(staffTimezone);

    const seriesData = {
      tenant_id: tenantId,
      client_id: input.client_id,
      staff_id: staffId,
      service_id: input.service_id,
      rrule: input.rrule,
      start_at: startUTC, // Already an ISO string in UTC
      duration_minutes: input.duration_minutes,
      time_zone: dbTimezone,
      series_end_date: input.series_end_date || null,
      max_occurrences: input.max_occurrences || null,
      is_active: true,
      notes: input.notes || null,
      created_by_profile_id: user.id,
    };

    // Insert the series
    const { data: newSeries, error: insertError } = await supabase
      .from('appointment_series')
      .insert(seriesData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating appointment series:', insertError);
      toast({
        variant: 'destructive',
        title: 'Failed to create recurring appointments',
        description: insertError.message,
      });
      throw insertError;
    }

    // Generate initial occurrences via edge function
    try {
      const { data: genResult, error: genError } = await supabase.functions.invoke(
        'generate-appointment-occurrences',
        {
          body: {
            seriesId: newSeries.id,
            monthsAhead: 3,
            maxOccurrences: 200,
            is_telehealth: input.is_telehealth ?? false,
          },
        }
      );

      if (genError) {
        console.error('Error generating occurrences:', genError);
        toast({
          variant: 'destructive',
          title: 'Series created but occurrences failed',
          description: genError.message,
        });
      } else {
        toast({
          title: 'Recurring appointments created',
          description: `Series created with ${genResult?.generated?.created || 0} initial appointments`,
        });
      }
    } catch (err: any) {
      console.error('Error invoking generate function:', err);
      toast({
        variant: 'destructive',
        title: 'Series created but occurrences failed',
        description: err.message,
      });
    }

    await refetch();
    return newSeries;
  };

  // Update an existing series
  const updateSeries = async (seriesId: string, updates: Partial<AppointmentSeries>) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    const { data, error: updateError } = await supabase
      .from('appointment_series')
      .update(updates)
      .eq('id', seriesId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating series:', updateError);
      throw updateError;
    }

    // Regenerate occurrences if still active
    if (data.is_active) {
      try {
        await supabase.functions.invoke('generate-appointment-occurrences', {
          body: {
            seriesId: data.id,
            monthsAhead: 3,
            maxOccurrences: 200,
          },
        });
      } catch (err) {
        console.error('Error regenerating occurrences:', err);
      }
    }

    toast({
      title: 'Series updated',
      description: 'The recurring appointment series has been updated.',
    });

    await refetch();
    return data;
  };

  // Delete/deactivate a series
  const deleteSeries = async (seriesId: string) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    // Soft delete by setting is_active to false
    const { error: deleteError } = await supabase
      .from('appointment_series')
      .update({ is_active: false })
      .eq('id', seriesId)
      .eq('tenant_id', tenantId);

    if (deleteError) {
      console.error('Error deleting series:', deleteError);
      throw deleteError;
    }

    toast({
      title: 'Series deleted',
      description: 'The recurring appointment series has been deactivated.',
    });

    await refetch();
  };

  // Toggle series active status
  const toggleActive = async (seriesId: string, isActive: boolean) => {
    return updateSeries(seriesId, { is_active: isActive });
  };

  return {
    series: series || [],
    loading,
    error,
    refetch,
    createSeries,
    updateSeries,
    deleteSeries,
    toggleActive,
  };
}
