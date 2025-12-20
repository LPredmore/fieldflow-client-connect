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
    
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'America/New_York';
    }
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
  timezone: string;
  isLoading: boolean;
  hasStaffTimezone: boolean;
} {
  const { user } = useAuth();
  const [freshTimezone, setFreshTimezone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch fresh timezone on mount
  useEffect(() => {
    let mounted = true;

    const fetchTimezone = async () => {
      const staffId = user?.roleContext?.staffData?.id;
      if (!staffId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('staff')
          .select('prov_time_zone')
          .eq('id', staffId)
          .single();

        if (mounted && !error && data?.prov_time_zone) {
          setFreshTimezone(data.prov_time_zone);
        }
      } catch (err) {
        console.error('Failed to fetch staff timezone:', err);
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

  // Resolve timezone: fresh > cached > browser fallback
  const timezone = useMemo(() => {
    if (freshTimezone) return freshTimezone;
    
    const cachedTimezone = user?.roleContext?.staffData?.prov_time_zone;
    if (cachedTimezone) return cachedTimezone;
    
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'America/New_York';
    }
  }, [freshTimezone, user?.roleContext?.staffData?.prov_time_zone]);

  return {
    timezone,
    isLoading,
    hasStaffTimezone: Boolean(freshTimezone || user?.roleContext?.staffData?.prov_time_zone),
  };
}
