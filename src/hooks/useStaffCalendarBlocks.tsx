import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CalendarBlock {
  id: string;
  staff_id: string;
  start_at: string;
  end_at: string;
  source: string;
  summary: string;
  // "Fake local" Date objects for react-big-calendar grid positioning
  calendar_start: Date;
  calendar_end: Date;
}

/**
 * Creates a "fake local" Date that tricks react-big-calendar into correct grid positioning.
 * Uses integer time components from the server RPC (same pattern as useStaffAppointments).
 */
function createFakeLocalDate(
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

interface UseStaffCalendarBlocksOptions {
  staffTimezone?: string; // kept for API compat but no longer used client-side
  enabled?: boolean;
}

/**
 * Fetches external calendar blocks (Google Calendar busy periods)
 * for the logged-in staff member using the server-side get_staff_calendar_blocks RPC.
 * All timezone conversion happens in PostgreSQL — no client-side Intl API usage.
 */
export function useStaffCalendarBlocks(options?: UseStaffCalendarBlocksOptions) {
  const { user } = useAuth();
  const { enabled = true } = options || {};
  const staffId = user?.roleContext?.staffData?.id;

  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBlocks = useCallback(async () => {
    if (!staffId || !enabled) {
      setBlocks([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_staff_calendar_blocks', {
        p_staff_id: staffId,
        p_from_date: new Date().toISOString(),
      });

      if (error) {
        console.error('[useStaffCalendarBlocks] RPC error:', error);
        setBlocks([]);
        return;
      }

      const transformed: CalendarBlock[] = (data || []).map((row: any) => ({
        id: row.id,
        staff_id: row.staff_id,
        start_at: row.start_at,
        end_at: row.end_at,
        source: row.source,
        summary: row.summary || 'Busy',
        calendar_start: createFakeLocalDate(
          row.start_year, row.start_month, row.start_day,
          row.start_hour, row.start_minute
        ),
        calendar_end: createFakeLocalDate(
          row.end_year, row.end_month, row.end_day,
          row.end_hour, row.end_minute
        ),
      }));

      setBlocks(transformed);
    } catch (err) {
      console.error('[useStaffCalendarBlocks] Error:', err);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [staffId, enabled]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  // Convert to RBC background events format
  const backgroundEvents = useMemo(() => {
    return blocks.map((block) => ({
      id: `block-${block.id}`,
      title: block.summary,
      start: block.calendar_start,
      end: block.calendar_end,
      resource: {
        isExternalBlock: true,
        source: block.source,
      },
    }));
  }, [blocks]);

  return {
    blocks,
    backgroundEvents,
    loading,
    refetch: fetchBlocks,
  };
}
