import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Get the current staff member's timezone from cached auth data.
 * 
 * Priority:
 * 1. Staff's saved prov_time_zone from profile
 * 2. Browser timezone as fallback
 */
export function useStaffTimezone(): string {
  const { user } = useAuth();
  
  const timezone = useMemo(() => {
    const staffTimezone = user?.roleContext?.staffData?.prov_time_zone;
    if (staffTimezone) {
      return staffTimezone;
    }
    
    // Fallback to America/New_York to match database RPC default
    // This ensures storage and display use the same timezone when prov_time_zone is not set
    return 'America/New_York';
  }, [user?.roleContext?.staffData?.prov_time_zone]);
  
  return timezone;
}

/**
 * Check if the staff member has a saved timezone or is using browser fallback.
 */
export function useHasStaffTimezone(): boolean {
  const { user } = useAuth();
  return Boolean(user?.roleContext?.staffData?.prov_time_zone);
}

/**
 * Get the staff timezone with a fresh database check on mount.
 * This avoids triggering a full auth refresh while ensuring current timezone.
 * Use this for components that need guaranteed fresh timezone data.
 */
export function useFreshStaffTimezone(): {
  timezone: string | null;  // null while loading
  isLoading: boolean;
  hasStaffTimezone: boolean;
} {
  const { user } = useAuth();
  const [freshTimezone, setFreshTimezone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryComplete, setQueryComplete] = useState(false);

  // Fetch fresh timezone on mount - BLOCKS until complete
  useEffect(() => {
    let mounted = true;

    const fetchTimezone = async () => {
      const staffId = user?.roleContext?.staffData?.id;
      console.log('[useFreshStaffTimezone] fetchTimezone called', { staffId, hasUser: !!user });
      if (!staffId) {
        // Staff ID not available yet (auth still hydrating).
        // Stay in loading state -- do NOT mark queryComplete.
        // The effect will re-run when staffId becomes available.
        return;
      }

      try {
        const { data, error } = await supabase
          .from('staff')
          .select('prov_time_zone')
          .eq('id', staffId)
          .single();

        if (mounted) {
          console.log('[useFreshStaffTimezone] Query result', { data, error, prov_time_zone: data?.prov_time_zone });
          if (!error && data?.prov_time_zone) {
            setFreshTimezone(data.prov_time_zone);
          }
          setQueryComplete(true);
        }
      } catch (err) {
        console.error('Failed to fetch staff timezone:', err);
        if (mounted) {
          setQueryComplete(true);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTimezone();

    return () => {
      mounted = false;
    };
  }, [user?.roleContext?.staffData?.id]);

  // Only resolve timezone AFTER query completes - blocks until fresh data
  const timezone = useMemo(() => {
    const result = !queryComplete ? null : (freshTimezone || 'America/New_York');
    console.log('[useFreshStaffTimezone] timezone memo', { queryComplete, freshTimezone, result, isLoading });
    return result;
  }, [queryComplete, freshTimezone, isLoading]);

  return {
    timezone,
    isLoading,
    hasStaffTimezone: Boolean(freshTimezone),
  };
}
