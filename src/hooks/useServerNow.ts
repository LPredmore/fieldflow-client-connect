import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Server-authoritative "now" hook.
 * 
 * Fetches the current time components from PostgreSQL via get_now_in_timezone RPC,
 * ensuring the green current-time indicator and dashboard filters use the same
 * server-authoritative timezone engine as appointment positioning.
 * 
 * Refreshes every 60 seconds to keep the green line moving.
 * Falls back to last known value during refresh (no loading flicker).
 * On initial load failure, falls back to browser time (same as previous behavior).
 */

interface ServerNow {
  /** "Fake local" Date where getHours() returns the staff's local hour */
  fakeLocalNow: Date;
  /** Today's date string in YYYY-MM-DD format in the staff's timezone */
  todayDate: string;
  /** Whether the initial fetch is still loading */
  isLoading: boolean;
}

/**
 * Creates a "fake local" Date object matching the pattern used for appointment positioning.
 * getHours()/getMinutes() will return the staff's local time components.
 */
function createFakeLocalNowDate(
  year: number,
  month: number, // 1-12 from PostgreSQL
  day: number,
  hour: number,
  minute: number
): Date {
  const d = new Date();
  d.setFullYear(year, month - 1, day); // JS months are 0-indexed
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Browser-time fallback (used only on initial load failure) */
function browserFallback(): { fakeLocalNow: Date; todayDate: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    fakeLocalNow: now,
    todayDate: `${y}-${m}-${d}`,
  };
}

const REFRESH_INTERVAL_MS = 60_000; // 60 seconds

export function useServerNow(timezone: string): ServerNow {
  const [fakeLocalNow, setFakeLocalNow] = useState<Date>(() => browserFallback().fakeLocalNow);
  const [todayDate, setTodayDate] = useState<string>(() => browserFallback().todayDate);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchServerNow = useCallback(async (tz: string) => {
    try {
      const { data, error } = await supabase.rpc('get_now_in_timezone', {
        p_timezone: tz,
      });

      if (error) {
        console.error('[useServerNow] RPC error:', error);
        return;
      }

      // RPC returns a single-row table
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return;

      const newFakeLocal = createFakeLocalNowDate(
        row.now_year,
        row.now_month,
        row.now_day,
        row.now_hour,
        row.now_minute
      );

      setFakeLocalNow(newFakeLocal);
      setTodayDate(row.today_date);
      setIsLoading(false);
    } catch (err) {
      console.error('[useServerNow] Fetch error:', err);
      // Keep previous values — no flicker
    }
  }, []);

  useEffect(() => {
    if (!timezone) return;

    // Initial fetch
    fetchServerNow(timezone);

    // Refresh every 60 seconds
    intervalRef.current = setInterval(() => {
      fetchServerNow(timezone);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timezone, fetchServerNow]);

  return { fakeLocalNow, todayDate, isLoading };
}
