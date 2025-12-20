import { useMemo } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook to get the current user's effective timezone.
 * 
 * For staff users: Uses prov_time_zone from their profile (if set)
 * For all users: Falls back to browser timezone
 * 
 * This is the SINGLE SOURCE OF TRUTH for timezone in the application.
 */
export function useUserTimezone(): string {
  const { user } = useAuth();
  
  const effectiveTimezone = useMemo(() => {
    // For staff users, prefer their saved timezone
    const staffTimezone = user?.roleContext?.staffData?.prov_time_zone;
    if (staffTimezone) {
      return staffTimezone;
    }
    
    // Fallback to browser timezone
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      console.warn('Failed to detect browser timezone, falling back to America/New_York');
      return 'America/New_York';
    }
  }, [user?.roleContext?.staffData?.prov_time_zone]);

  return effectiveTimezone;
}