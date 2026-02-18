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
 * Uses the same pattern as useStaffAppointments.
 */
function createFakeLocalDateFromISO(isoString: string, timezone: string): Date {
  // Parse the ISO timestamp into the staff's timezone to extract local components
  // We use Intl.DateTimeFormat to extract local components in the target timezone
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
  
  const d = new Date();
  d.setFullYear(get('year'), get('month') - 1, get('day'));
  d.setHours(get('hour'), get('minute'), 0, 0);
  return d;
}

interface UseStaffCalendarBlocksOptions {
  staffTimezone?: string;
  enabled?: boolean;
}

/**
 * Fetches external calendar blocks (Google Calendar busy periods)
 * for the logged-in staff member. Returns them as calendar-ready events.
 */
export function useStaffCalendarBlocks(options?: UseStaffCalendarBlocksOptions) {
  const { user } = useAuth();
  const { staffTimezone = 'America/New_York', enabled = true } = options || {};
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
      const { data, error } = await supabase
        .from('staff_calendar_blocks')
        .select('id, staff_id, start_at, end_at, source, summary')
        .eq('staff_id', staffId)
        .gte('end_at', new Date().toISOString())
        .order('start_at', { ascending: true });

      if (error) {
        console.error('[useStaffCalendarBlocks] Error:', error);
        setBlocks([]);
        return;
      }

      const transformed: CalendarBlock[] = (data || []).map((row) => ({
        id: row.id,
        staff_id: row.staff_id,
        start_at: row.start_at,
        end_at: row.end_at,
        source: row.source,
        summary: row.summary || 'Busy',
        calendar_start: createFakeLocalDateFromISO(row.start_at, staffTimezone),
        calendar_end: createFakeLocalDateFromISO(row.end_at, staffTimezone),
      }));

      setBlocks(transformed);
    } catch (err) {
      console.error('[useStaffCalendarBlocks] Error:', err);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [staffId, enabled, staffTimezone]);

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
