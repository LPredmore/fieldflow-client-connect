import { useMemo } from 'react';
import { useAuth } from './useAuth';

/**
 * Get the current staff member's timezone.
 * 
 * Priority:
 * 1. Staff's saved prov_time_zone from profile
 * 2. Browser timezone as fallback
 * 
 * This hook ensures consistent timezone handling across all staff views,
 * regardless of which device or browser they're using.
 */
export function useStaffTimezone(): string {
  const { user } = useAuth();
  
  const timezone = useMemo(() => {
    // First priority: Staff's saved timezone
    const staffTimezone = user?.roleContext?.staffData?.prov_time_zone;
    if (staffTimezone) {
      return staffTimezone;
    }
    
    // Fallback: Browser timezone
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
