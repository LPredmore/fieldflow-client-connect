import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { useUserTimezone } from './useUserTimezone';
import { combineDateTimeToUTC, DEFAULT_TIMEZONE, formatInUserTimezone } from '@/lib/timezoneUtils';

export interface UnifiedJob {
  id: string;
  created_at: string;
  updated_at?: string;
  tenant_id: string;
  created_by_user_id: string;
  customer_id: string;
  customer_name: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to_user_id?: string;
  service_id?: string | null;
  service_name?: string | null;
  service_category?: string | null;
  actual_cost?: number;
  start_at: string;
  end_at: string;
  series_id?: string;
  appointment_type: 'one_time' | 'recurring_instance';
  completion_notes?: string;
  additional_info?: string;
  contractor_name?: string;
  timezone?: string;
  // Original job fields for backward compatibility
  scheduled_date?: string;
  scheduled_time?: string;
  complete_date?: string;
  estimated_duration?: number;
}

// Export aliases for "Appointment" naming
export type UnifiedAppointment = UnifiedJob;

/**
 * Configuration options for the useUnifiedAppointments hook
 * 
 * This interface supports conditional loading patterns to optimize performance
 * by preventing unnecessary data fetching when components are not visible
 * or when data is not needed for the current route.
 */
export interface UseUnifiedAppointmentsOptions {
  /**
   * Controls whether the hook should execute queries
   * 
   * When false, the hook will:
   * - Skip all database queries
   * - Return empty arrays for data
   * - Set loading to false immediately
   * - Not trigger any side effects
   * 
   * Use this for route-based conditional loading:
   * @example
   * ```tsx
   * const location = useLocation();
   * const isDashboardRoute = location.pathname === '/';
   * const { unifiedJobs } = useUnifiedAppointments({ enabled: isDashboardRoute });
   * ```
   */
  enabled?: boolean;
  
  /**
   * Controls whether to skip appointment occurrence queries
   * 
   * When true, only one-time appointments from appointment_series will be loaded.
   * This is useful when:
   * - Only displaying summary data
   * - Reducing initial page load time
   * - The component doesn't need recurring appointment instances
   * 
   * @example
   * ```tsx
   * // For dashboard summary that only shows recent one-time jobs
   * const { unifiedJobs } = useUnifiedAppointments({ 
   *   enabled: true, 
   *   skipOccurrences: true 
   * });
   * ```
   */
  skipOccurrences?: boolean;
}

/**
 * Unified hook for managing appointments and jobs across the application
 * 
 * This hook implements conditional loading patterns to optimize performance:
 * - Route-based loading: Only fetch data when needed for current route
 * - Component-based loading: Skip queries when components are not visible
 * - Graceful degradation: Show cached data when circuit breaker is open
 * 
 * Performance optimizations:
 * - Caching with stale-while-revalidate strategy
 * - Circuit breaker protection against failing queries
 * - Throttling to prevent excessive requests
 * - Conditional execution based on route/visibility
 * 
 * @param options Configuration for conditional loading and query optimization
 * @returns Unified job data with loading states and error handling
 * 
 * @example Route-based conditional loading
 * ```tsx
 * const location = useLocation();
 * const isDashboardRoute = location.pathname === '/';
 * const { unifiedJobs, loading, error } = useUnifiedAppointments({ 
 *   enabled: isDashboardRoute 
 * });
 * ```
 * 
 * @example Component visibility-based loading
 * ```tsx
 * const [isVisible, setIsVisible] = useState(false);
 * const { unifiedJobs } = useUnifiedAppointments({ 
 *   enabled: isVisible,
 *   skipOccurrences: !isVisible // Skip heavy queries when not visible
 * });
 * ```
 */
export function useUnifiedJobs(options?: UseUnifiedAppointmentsOptions) {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const userTimezone = useUserTimezone();

  // Extract options with defaults
  const { enabled = true, skipOccurrences = false } = options || {};

  // Query one-time jobs from appointment_series
  const {
    data: oneTimeJobSeries,
    loading: oneTimeLoading,
    error: oneTimeError,
    refetch: refetchOneTime,
    isStale: oneTimeIsStale,
    isCircuitBreakerOpen: oneTimeCircuitOpen,
    lastUpdated: oneTimeLastUpdated,
    errorType: oneTimeErrorType,
  } = useSupabaseQuery<any>({
    table: 'appointment_series',
    filters: {
      is_recurring: false,
      tenant_id: 'auto',
    },
    orderBy: { column: 'created_at', ascending: false },
    enabled: enabled, // Conditional execution based on enabled flag
    onError: (error) => {
      // Only show toast if we don't have cached data to fall back to
      if (!oneTimeJobSeries || oneTimeJobSeries.length === 0) {
        toast({
          variant: "destructive",
          title: "Error loading jobs",
          description: error.message,
        });
      }
    },
  });

  // Query recurring job instances (appointment occurrences)
  const {
    data: jobOccurrences,
    loading: occurrencesLoading,
    error: occurrencesError,
    refetch: refetchOccurrences,
    isStale: occurrencesIsStale,
    isCircuitBreakerOpen: occurrencesCircuitOpen,
    lastUpdated: occurrencesLastUpdated,
    errorType: occurrencesErrorType,
  } = useSupabaseQuery<any>({
    table: 'appointment_occurrences',
    select: `
      id,
      series_id,
      tenant_id,
      customer_id,
      assigned_to_user_id,
      start_at,
      end_at,
      status,
      priority,
      actual_cost,
      notes,
      title,
      description,
      created_at,
      updated_at,
      customers!inner(pat_name_f, pat_name_l, pat_name_m, preferred_name),
      appointment_series!inner(
        title,
        description,
        service_id,
        services!fk_appointment_series_service(id, name, category, description)
      )
    `,
    filters: {
      tenant_id: 'auto',
    },
    orderBy: { column: 'start_at', ascending: false },
    staleTime: 120000, // 2 minutes cache
    throttleMs: 5000, // 5 seconds throttle
    enabled: enabled && !skipOccurrences, // Conditional execution based on enabled flag and skipOccurrences option
    onError: (error) => {
      // Only show toast if we don't have cached data to fall back to
      if (!jobOccurrences || jobOccurrences.length === 0) {
        toast({
          variant: "destructive",
          title: "Error loading job occurrences",
          description: error.message,
        });
      }
    },
  });

  // State for unified jobs and custom loading
  const [unifiedJobs, setUnifiedJobs] = useState<UnifiedJob[]>([]);
  const [customLoading, setCustomLoading] = useState(true);

  // Transform and combine data when both queries complete
  const processUnifiedJobs = useCallback(async () => {
    if (!user || !tenantId) {
      return;
    }

    // If queries are disabled, set empty state and return
    if (!enabled) {
      setUnifiedJobs([]);
      setCustomLoading(false);
      return;
    }

    // Wait for enabled queries to complete
    if (oneTimeLoading || (!skipOccurrences && occurrencesLoading)) {
      return;
    }

    try {
      setCustomLoading(true);

      // Transform one-time job series to unified format
      const transformedOneTimeJobs: UnifiedJob[] = [];
      
      for (const job of oneTimeJobSeries || []) {
        // Get contractor name separately
        let contractorName;
        if (job.assigned_to_user_id) {
          try {
            const { data: contractorData, error } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', job.assigned_to_user_id)
              .single();
            
            if (error) {
              console.warn(`Failed to fetch contractor for ID ${job.assigned_to_user_id}:`, error);
              contractorName = 'Unknown User';
            } else {
              contractorName = contractorData?.full_name || 
                              contractorData?.email?.split('@')[0] || 
                              'Unnamed User';
            }
          } catch (err) {
            console.warn(`Error fetching contractor for ID ${job.assigned_to_user_id}:`, err);
            contractorName = 'Unknown User';
          }
        }
        
        try {
          // Convert local_start_time and duration to start/end times using proper timezone conversion
          const startTime = job.local_start_time || '08:00:00';
          const startTimeFormatted = startTime.substring(0, 5); // HH:mm format
          
          // Use the job's timezone or fall back to default
          const timezone = job.timezone || DEFAULT_TIMEZONE;
          
          // Properly convert local time to UTC
          const utcStart = combineDateTimeToUTC(job.start_date, startTimeFormatted, timezone);
          const utcEnd = new Date(utcStart.getTime() + (job.duration_minutes || 60) * 60000);

          transformedOneTimeJobs.push({
            id: job.id,
            created_at: job.created_at,
            updated_at: job.updated_at,
            tenant_id: job.tenant_id,
            created_by_user_id: job.created_by_user_id,
            customer_id: job.customer_id,
            customer_name: job.customer_name,
            title: job.title,
            description: job.description,
            status: 'scheduled' as const, // One-time jobs from job_series are always scheduled until they have occurrences
            priority: job.priority,
            assigned_to_user_id: job.assigned_to_user_id,
            service_id: job.service_id || null,
            service_name: null, // Will be populated if we add a join
            service_category: null,
            actual_cost: null, // No actual cost until job is completed
            start_at: utcStart.toISOString(),
            end_at: utcEnd.toISOString(),
            appointment_type: 'one_time' as const,
            completion_notes: undefined,
            additional_info: job.description,
            contractor_name: contractorName,
            timezone: timezone,
            // Backward compatibility fields
            scheduled_date: job.start_date,
            scheduled_time: startTimeFormatted,
            complete_date: undefined,
            estimated_duration: job.duration_minutes / 60, // Convert minutes to hours
          });
        } catch (error) {
          console.error('Error transforming job:', job.id, error);
        }
      }

      // Filter out job occurrences with invalid dates and transform to unified format
      const transformedJobOccurrences: UnifiedJob[] = (jobOccurrences || [])
        .filter(occurrence => occurrence.start_at && occurrence.end_at)
        .map(occurrence => {
          try {
            // Validate that start_at and end_at are valid dates
            const startDate = new Date(occurrence.start_at);
            const endDate = new Date(occurrence.end_at);
            
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              console.warn('Invalid date in occurrence:', occurrence.id, occurrence.start_at, occurrence.end_at);
              return null;
            }

            const service = occurrence.appointment_series?.services;
            return {
              id: occurrence.id,
              created_at: occurrence.created_at,
              updated_at: occurrence.updated_at,
              tenant_id: occurrence.tenant_id,
              created_by_user_id: user?.id || '', // Use current user as creator for occurrences
              customer_id: occurrence.customer_id,
              customer_name: [
                occurrence.customers?.pat_name_f,
                occurrence.customers?.pat_name_m,
                occurrence.customers?.pat_name_l
              ].filter(Boolean).join(' ').trim() || occurrence.customers?.preferred_name || 'Unknown Customer',
              title: occurrence.title || occurrence.appointment_series?.title || 'Recurring Job',
              description: occurrence.description || occurrence.appointment_series?.description,
              status: occurrence.status,
              priority: occurrence.priority,
              assigned_to_user_id: occurrence.assigned_to_user_id,
              service_id: occurrence.appointment_series?.service_id || null,
              service_name: service?.name || null,
              service_category: service?.category || null,
              actual_cost: occurrence.actual_cost,
              start_at: occurrence.start_at,
              end_at: occurrence.end_at,
              series_id: occurrence.series_id,
              appointment_type: 'recurring_instance' as const,
              completion_notes: occurrence.notes,
              additional_info: occurrence.appointment_series?.description,
              // Backward compatibility fields
              scheduled_date: occurrence.start_at.split('T')[0],
              scheduled_time: formatInUserTimezone(occurrence.start_at, userTimezone, 'HH:mm'),
              complete_date: occurrence.status === 'completed' ? occurrence.start_at.split('T')[0] : undefined
            };
          } catch (error) {
            console.error('Error transforming occurrence:', occurrence.id, error);
            return null;
          }
        })
        .filter((occurrence): occurrence is NonNullable<typeof occurrence> => occurrence !== null);

      // Combine and sort by start date
      const combined = [...transformedOneTimeJobs, ...transformedJobOccurrences]
        .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());

      setUnifiedJobs(combined);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error processing jobs",
        description: error.message,
      });
    } finally {
      setCustomLoading(false);
    }
  }, [user, tenantId, oneTimeJobSeries, jobOccurrences, oneTimeLoading, occurrencesLoading, userTimezone, enabled, skipOccurrences]);

  // Process unified jobs when data changes
  useEffect(() => {
    processUnifiedJobs();
  }, [processUnifiedJobs]);

  // Refetch function that triggers both queries
  const fetchUnifiedJobs = useCallback(async () => {
    await Promise.all([refetchOneTime(), refetchOccurrences()]);
  }, [refetchOneTime, refetchOccurrences]);

  // Get upcoming scheduled jobs for dashboard
  const upcomingJobs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return unifiedJobs
      .filter(job => job.status === 'scheduled' && new Date(job.start_at) <= today)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 3);
  }, [unifiedJobs]);

  const updateJob = async (jobId: string, updates: Partial<UnifiedJob>) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    const job = unifiedJobs.find(j => j.id === jobId);
    if (!job) throw new Error('Job not found');

    const isStatusChangingToCompleted = updates.status === 'completed' && job.status !== 'completed';
    const isStatusChangingToCancelled = updates.status === 'cancelled' && job.status !== 'cancelled';

    // Handle cancellation of recurring jobs
    if (isStatusChangingToCancelled && job.appointment_type === 'recurring_instance' && job.series_id) {
      // Cancel all future occurrences in the series
      const { error: cancelError } = await supabase
        .from('appointment_occurrences')
        .update({ status: 'cancelled' })
        .eq('series_id', job.series_id)
        .gt('start_at', new Date().toISOString())
        .neq('status', 'completed'); // Don't cancel completed ones

      if (cancelError) {
        console.error('Error cancelling future occurrences:', cancelError);
      }
    }

    // Update the specific job/occurrence
    let data, error;
    if (job.appointment_type === 'one_time') {
      // Update in appointment_series table (one-time jobs are now stored there with is_recurring=false)
      const { contractor_name, appointment_type, start_at, end_at, series_id, scheduled_date, scheduled_time, complete_date, estimated_duration, ...dbUpdates } = updates;
      ({ data, error } = await supabase
        .from('appointment_series')
        .update(dbUpdates)
        .eq('id', jobId)
        .select()
        .single());
    } else {
      // Update in appointment_occurrences table
      const { contractor_name, appointment_type, scheduled_date, scheduled_time, complete_date, 
              estimated_duration, ...dbUpdates } = updates;
      ({ data, error } = await supabase
        .from('appointment_occurrences')
        .update(dbUpdates)
        .eq('id', jobId)
        .select()
        .single());
    }

    if (error) throw error;
    
    // Show toast based on status change
    if (isStatusChangingToCompleted) {
      toast({
        title: "Job completed",
        description: "The job has been marked as completed.",
      });
    } else if (isStatusChangingToCancelled && job.appointment_type === 'recurring_instance') {
      toast({
        title: "Appointment series cancelled",
        description: "This appointment and all future occurrences in the series have been cancelled.",
      });
    } else {
      toast({
        title: "Appointment updated",
        description: "The appointment has been successfully updated.",
      });
    }
    
    await fetchUnifiedJobs();
    return data;
  };

  const deleteJob = async (jobId: string) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    const job = unifiedJobs.find(j => j.id === jobId);
    if (!job) throw new Error('Job not found');

    let error;
    if (job.appointment_type === 'one_time') {
      ({ error } = await supabase.from('appointment_series').delete().eq('id', jobId));
    } else {
      ({ error } = await supabase.from('appointment_occurrences').delete().eq('id', jobId));
    }

    if (error) throw error;
    
    toast({
      title: "Appointment deleted",
      description: "The appointment has been successfully deleted.",
    });
    
    await fetchUnifiedJobs();
  };

  // Determine overall state for graceful degradation
  const isStale = oneTimeIsStale || occurrencesIsStale;
  const isCircuitBreakerOpen = oneTimeCircuitOpen || occurrencesCircuitOpen;
  const lastUpdated = oneTimeLastUpdated && occurrencesLastUpdated 
    ? new Date(Math.min(oneTimeLastUpdated.getTime(), occurrencesLastUpdated.getTime()))
    : oneTimeLastUpdated || occurrencesLastUpdated;
  const errorType = oneTimeErrorType || occurrencesErrorType;

  return {
    unifiedJobs,
    upcomingJobs,
    loading: customLoading || oneTimeLoading || occurrencesLoading,
    error: oneTimeError || occurrencesError,
    refetchJobs: fetchUnifiedJobs,
    updateJob,
    deleteJob,
    // Graceful degradation properties
    isStale,
    isCircuitBreakerOpen,
    lastUpdated,
    errorType,
  };
}

// Export alias for "Appointment" naming
export const useUnifiedAppointments = useUnifiedJobs;