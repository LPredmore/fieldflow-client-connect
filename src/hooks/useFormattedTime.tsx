import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserTimezone } from './useUserTimezone';

/**
 * Format codes mapping for convenience
 * PostgreSQL TO_CHAR formats
 */
export const TIME_FORMATS = {
  TIME_12H: 'HH12:MI AM',           // 4:00 AM
  TIME_12H_COMPACT: 'FMHH12:MI AM', // 4:00 AM (no leading zeros)
  TIME_24H: 'HH24:MI',              // 04:00
  DATE_FULL: 'FMDay, FMMonth DD, YYYY', // Saturday, December 20, 2025
  DATE_SHORT: 'MM/DD/YYYY',         // 12/20/2025
  DATE_ISO: 'YYYY-MM-DD',           // 2025-12-20
  DATETIME_FULL: 'FMMonth DD, YYYY HH12:MI AM', // December 20, 2025 4:00 AM
} as const;

interface UseFormattedTimeResult {
  formattedValue: string | null;
  isLoading: boolean;
  error: Error | null;
}

// Cache for formatted times to avoid repeated RPC calls
const formatCache = new Map<string, string>();

/**
 * Hook to format a UTC timestamp using database-level timezone conversion.
 * Uses the PostgreSQL `format_timestamp_in_timezone` function for reliable conversion.
 * 
 * @param utcTimestamp - UTC timestamp string from the database
 * @param format - PostgreSQL TO_CHAR format string (default: 'FMHH12:MI AM')
 * @param timezone - Optional timezone override (defaults to browser timezone)
 * @returns Object with formattedValue, isLoading, and error
 */
export function useFormattedTime(
  utcTimestamp: string | null | undefined,
  format: string = TIME_FORMATS.TIME_12H_COMPACT,
  timezone?: string
): UseFormattedTimeResult {
  const browserTimezone = useUserTimezone();
  const tz = timezone || browserTimezone;
  
  const [formattedValue, setFormattedValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cacheKey = useMemo(() => {
    if (!utcTimestamp) return null;
    return `${utcTimestamp}|${tz}|${format}`;
  }, [utcTimestamp, tz, format]);

  useEffect(() => {
    if (!utcTimestamp || !cacheKey) {
      setFormattedValue(null);
      return;
    }

    // Check cache first
    const cached = formatCache.get(cacheKey);
    if (cached) {
      setFormattedValue(cached);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchFormatted = async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc(
          'format_timestamp_in_timezone',
          {
            p_timestamp: utcTimestamp,
            p_timezone: tz,
            p_format: format,
          }
        );

        if (cancelled) return;

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        const result = data as string;
        formatCache.set(cacheKey, result);
        setFormattedValue(result);
      } catch (err) {
        if (cancelled) return;
        console.error('Error formatting timestamp:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        // Fallback to local formatting if RPC fails
        setFormattedValue(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchFormatted();

    return () => {
      cancelled = true;
    };
  }, [utcTimestamp, cacheKey, tz, format]);

  return { formattedValue, isLoading, error };
}

/**
 * Batch format multiple timestamps at once using the database function.
 * More efficient than calling useFormattedTime multiple times.
 * 
 * @param timestamps - Array of UTC timestamp strings
 * @param format - PostgreSQL TO_CHAR format string
 * @param timezone - Timezone for conversion
 * @returns Promise resolving to array of formatted strings
 */
export async function batchFormatTimestamps(
  timestamps: string[],
  format: string = TIME_FORMATS.TIME_12H_COMPACT,
  timezone: string
): Promise<string[]> {
  if (timestamps.length === 0) return [];

  const results: string[] = [];
  const uncachedIndexes: number[] = [];
  const uncachedTimestamps: string[] = [];

  // Check cache first
  timestamps.forEach((ts, index) => {
    const cacheKey = `${ts}|${timezone}|${format}`;
    const cached = formatCache.get(cacheKey);
    if (cached) {
      results[index] = cached;
    } else {
      uncachedIndexes.push(index);
      uncachedTimestamps.push(ts);
    }
  });

  // Fetch uncached timestamps
  if (uncachedTimestamps.length > 0) {
    const promises = uncachedTimestamps.map((ts) =>
      supabase.rpc('format_timestamp_in_timezone', {
        p_timestamp: ts,
        p_timezone: timezone,
        p_format: format,
      })
    );

    const responses = await Promise.all(promises);

    responses.forEach((response, i) => {
      const originalIndex = uncachedIndexes[i];
      const ts = uncachedTimestamps[i];
      const cacheKey = `${ts}|${timezone}|${format}`;

      if (response.error) {
        console.error('Error formatting timestamp:', response.error);
        results[originalIndex] = '';
      } else {
        const result = response.data as string;
        formatCache.set(cacheKey, result);
        results[originalIndex] = result;
      }
    });
  }

  return results;
}

/**
 * Clear the format cache (useful for testing or when timezone changes)
 */
export function clearFormatCache(): void {
  formatCache.clear();
}
