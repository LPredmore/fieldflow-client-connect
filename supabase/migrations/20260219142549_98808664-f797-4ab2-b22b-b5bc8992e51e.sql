
CREATE OR REPLACE FUNCTION public.get_now_in_timezone(p_timezone text DEFAULT 'America/New_York')
RETURNS TABLE(
  now_year integer,
  now_month integer,
  now_day integer,
  now_hour integer,
  now_minute integer,
  today_date text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(YEAR   FROM NOW() AT TIME ZONE p_timezone)::integer,
    EXTRACT(MONTH  FROM NOW() AT TIME ZONE p_timezone)::integer,
    EXTRACT(DAY    FROM NOW() AT TIME ZONE p_timezone)::integer,
    EXTRACT(HOUR   FROM NOW() AT TIME ZONE p_timezone)::integer,
    EXTRACT(MINUTE FROM NOW() AT TIME ZONE p_timezone)::integer,
    TO_CHAR(NOW() AT TIME ZONE p_timezone, 'YYYY-MM-DD');
$$;
