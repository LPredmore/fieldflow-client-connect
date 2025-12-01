import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from '@/hooks/data/useSupabaseMutation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { combineDateTimeToUTC } from '@/lib/timezoneUtils';
import { useUserTimezone } from './useUserTimezone';

export interface JobSeries {
  id: string;
  created_at: string;
  updated_at?: string;
  tenant_id: string;
  created_by_user_id: string;
  title: string;
  customer_id: string;
  customer_name: string;
  service_type: 'plumbing' | 'electrical' | 'hvac' | 'cleaning' | 'landscaping' | 'general_maintenance' | 'other';
  description?: string;
  start_date: string;
  local_start_time: string;
  duration_minutes: number;
  timezone: string;
  rrule: string;
  until_date?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to_user_id?: string;
  actual_cost?: number;
  completion_notes?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  // notes field removed - use description instead as appointment_series table doesn't have notes column
  active: boolean;
}

export interface CreateJobSeriesData {
  title: string;
  customer_id: string;
  customer_name?: string;
  service_id?: string;
  service_type?: JobSeries['service_type'];
  description?: string;
  start_date?: string;
  local_start_time?: string;
  duration_minutes?: number;
  timezone?: string;
  recurrence_rule?: string;
  rrule?: string;
  until_date?: string;
  priority?: JobSeries['priority'];
  assigned_to_user_id?: string;
  actual_cost?: number;
  completion_notes?: string;
  status?: JobSeries['status'];
  is_recurring?: boolean;
  active?: boolean;
}

// Export aliases for "Appointment" naming
export type AppointmentSeries = JobSeries;
export type CreateAppointmentSeriesData = CreateJobSeriesData;

export function useJobSeries() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const userTimezone = useUserTimezone();

  // Query job series using generic hook
  const {
    data: jobSeries,
    loading: queryLoading,
    error: queryError,
    refetch: refetchJobSeries,
  } = useSupabaseQuery<JobSeries>({
    table: 'appointment_series',
    filters: {
      tenant_id: 'auto', // Auto-apply tenant filter
    },
    orderBy: { column: 'created_at', ascending: false },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error loading job series",
        description: error.message,
      });
    },
  });

  // Create job series mutation
  const {
    mutate: createJobSeriesMutation,
    loading: createLoading,
    error: createError,
  } = useSupabaseInsert<CreateJobSeriesData>({
    table: 'appointment_series',
    onSuccess: (data) => {
      refetchJobSeries();
    },
  });

  const createJobSeries = async (seriesData: CreateJobSeriesData & Record<string, any>) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    console.log('Creating job series with data:', seriesData);

    // Clean the data to only include valid database columns
    const {
      // Remove any form-specific fields that don't exist in database
      additional_info,
      scheduled_date,
      start_time,
      end_time,
      complete_date,
      scheduled_time_utc,
      scheduled_end_time_utc,
      scheduled_time,
      scheduled_end_time,
      customer_name,
      service_type,
      completion_notes,
      actual_cost,
      status,
      ...validSeriesData
    } = seriesData;

    // Ensure rolling horizon fields are set
    const seriesDataWithDefaults = {
      ...validSeriesData,
      local_start_time: validSeriesData.local_start_time || '09:00:00',
      timezone: validSeriesData.timezone || userTimezone,
      duration_minutes: validSeriesData.duration_minutes || 60,
      priority: validSeriesData.priority || 'medium',
      generation_status: 'pending',
      active: validSeriesData.active !== undefined ? validSeriesData.active : true,
    };

    // Use the generic mutation for the insert
    const result = await createJobSeriesMutation(seriesDataWithDefaults);
    
    if (result.error) throw result.error;
    
    const data = result.data;
    console.log('Job series created successfully:', data);

    // Always create occurrences for all jobs (recurring and single)
    if (validSeriesData.is_recurring && (validSeriesData.rrule || validSeriesData.recurrence_rule)) {
      // For recurring jobs, use the edge function
      try {
        console.log('Generating occurrences for recurring job series:', data.id);
        
        const { data: functionResult, error: functionError } = await supabase.functions.invoke('generate-appointment-occurrences', {
          body: { 
            seriesId: data.id,
            monthsAhead: 3, // Initial 3-month horizon
            maxOccurrences: 200
          }
        });
        
        if (functionError) {
          throw new Error(functionError.message || 'Failed to generate job occurrences');
        }
        
        console.log('Occurrence generation result:', functionResult);
        toast({
          title: "Recurring job created",
          description: `Series created with ${functionResult.generated?.created || 0} initial occurrences`,
        });
      } catch (occurrenceError: any) {
        console.error('Error generating occurrences:', occurrenceError);
        toast({
          variant: "destructive",
          title: "Job created but occurrences failed",
          description: occurrenceError.message,
        });
      }
    } else {
      // For single occurrence jobs, create one occurrence with proper UTC timestamps
      console.log('Creating single occurrence for one-time job');
      
      // Use the provided UTC timestamps if available, otherwise construct from local time
      let startAtUTC: string;
      let endAtUTC: string;
      
      if (scheduled_time_utc && scheduled_end_time_utc) {
        // Use the pre-converted UTC timestamps from the form
        startAtUTC = scheduled_time_utc;
        endAtUTC = scheduled_end_time_utc;
        console.log('Using pre-converted UTC timestamps:', { startAtUTC, endAtUTC });
      } else {
        // Fallback: construct from date and local_start_time using proper timezone conversion
        const timezone = validSeriesData.timezone || userTimezone;
        
        // Normalize time to HH:mm format (remove seconds if present)
        const startTime = (validSeriesData.local_start_time || '08:00').split(':').slice(0, 2).join(':');
        
        // Convert local date/time to UTC using the series timezone
        const utcStartDate = combineDateTimeToUTC(validSeriesData.start_date, startTime, timezone);
        
        // Calculate end time by adding duration minutes
        const endUtcDate = new Date(utcStartDate.getTime() + (validSeriesData.duration_minutes || 60) * 60000);
        
        startAtUTC = utcStartDate.toISOString();
        endAtUTC = endUtcDate.toISOString();
        console.log(`Constructed timestamps using timezone ${timezone}:`, { startAtUTC, endAtUTC });
      }
      
      const occurrenceData = {
        series_id: data.id,
        customer_id: validSeriesData.customer_id,
        start_at: startAtUTC,
        end_at: endAtUTC,
        status: validSeriesData.status || 'scheduled',
        priority: validSeriesData.priority || 'medium',
        assigned_to_user_id: validSeriesData.assigned_to_user_id,
        tenant_id: tenantId,
      };

      console.log('Creating occurrence with data:', occurrenceData);
      
      const { error: occurrenceError } = await supabase
        .from('appointment_occurrences')
        .insert(occurrenceData);
      
      if (occurrenceError) {
        console.error('Error creating single occurrence:', occurrenceError);
        toast({
          variant: "destructive",
          title: "Job created but occurrence failed",
          description: occurrenceError.message,
        });
      } else {
        toast({
          title: "Job created",
          description: "Job created successfully and will appear in the calendar",
        });
      }
    }
    
    return data;
  };

  // Update job series mutation
  const {
    mutate: updateJobSeriesMutation,
    loading: updateLoading,
    error: updateError,
  } = useSupabaseUpdate<Partial<JobSeries>>({
    table: 'appointment_series',
    onSuccess: () => {
      refetchJobSeries();
    },
  });

  const updateJobSeries = async (seriesId: string, updates: Partial<JobSeries>) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    const result = await updateJobSeriesMutation({ id: seriesId, ...updates });
    
    if (result.error) throw result.error;
    
    const data = result.data;

    // Regenerate occurrences if the series is still active
    if (data.active) {
      try {
        const { data: functionResult, error: functionError } = await supabase.functions.invoke('generate-appointment-occurrences', {
          body: { 
            seriesId: data.id,
            monthsAhead: 3,
            maxOccurrences: 200
          }
        });
        
        if (functionError) {
          throw new Error(functionError.message || 'Failed to regenerate job occurrences');
        }
        
        console.log('Occurrence regeneration result:', functionResult);
      } catch (generateError: any) {
        console.error('Error regenerating occurrences:', generateError);
        toast({
          variant: "destructive", 
          title: "Warning: Occurrences not regenerated",
          description: `Job series updated but occurrences failed: ${generateError.message}`,
        });
      }
    }
    
    toast({
      title: "Recurring job updated",
      description: "The recurring job series has been successfully updated.",
    });
    
    return data;
  };

  // Delete job series mutation
  const {
    mutate: deleteJobSeriesMutation,
    loading: deleteLoading,
    error: deleteError,
  } = useSupabaseDelete({
    table: 'appointment_series',
    onSuccess: () => {
      refetchJobSeries();
    },
  });

  const deleteJobSeries = async (seriesId: string) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    const result = await deleteJobSeriesMutation(seriesId);
    
    if (result.error) throw result.error;
    
    toast({
      title: "Recurring job deleted",
      description: "The recurring job series and all future occurrences have been deleted.",
    });
  };

  const toggleSeriesActive = async (seriesId: string, active: boolean) => {
    return updateJobSeries(seriesId, { active });
  };

  return {
    jobSeries,
    loading: queryLoading || createLoading || updateLoading || deleteLoading,
    error: queryError || createError || updateError || deleteError,
    refetchJobSeries,
    createJobSeries,
    updateJobSeries,
    deleteJobSeries,
    toggleSeriesActive,
  };
}

// Export alias for "Appointment" naming  
export const useAppointmentSeries = useJobSeries;
