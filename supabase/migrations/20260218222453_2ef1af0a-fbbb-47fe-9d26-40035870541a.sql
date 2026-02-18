
-- Server-side local-to-UTC conversion function
-- Replaces broken client-side Luxon/date-fns-tz conversion
-- PostgreSQL AT TIME ZONE is the only reliable timezone engine in this stack
CREATE OR REPLACE FUNCTION public.convert_local_to_utc(
  p_date TEXT,
  p_time TEXT,
  p_timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TIMESTAMPTZ
LANGUAGE SQL
STABLE
AS $$
  SELECT (p_date || ' ' || p_time)::TIMESTAMP AT TIME ZONE p_timezone;
$$;
