CREATE OR REPLACE FUNCTION public.get_staff_calendar_blocks(
  p_staff_id UUID,
  p_from_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  id UUID,
  staff_id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  source TEXT,
  summary TEXT,
  start_year INT,
  start_month INT,
  start_day INT,
  start_hour INT,
  start_minute INT,
  end_year INT,
  end_month INT,
  end_day INT,
  end_hour INT,
  end_minute INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  -- Look up staff timezone, default to America/New_York
  SELECT COALESCE(s.prov_time_zone::TEXT, 'America/New_York')
  INTO v_timezone
  FROM staff s
  WHERE s.id = p_staff_id;

  IF v_timezone IS NULL THEN
    v_timezone := 'America/New_York';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.staff_id,
    b.start_at,
    b.end_at,
    b.source,
    COALESCE(b.summary, 'Busy') AS summary,
    EXTRACT(YEAR   FROM b.start_at AT TIME ZONE v_timezone)::INT AS start_year,
    EXTRACT(MONTH  FROM b.start_at AT TIME ZONE v_timezone)::INT AS start_month,
    EXTRACT(DAY    FROM b.start_at AT TIME ZONE v_timezone)::INT AS start_day,
    EXTRACT(HOUR   FROM b.start_at AT TIME ZONE v_timezone)::INT AS start_hour,
    EXTRACT(MINUTE FROM b.start_at AT TIME ZONE v_timezone)::INT AS start_minute,
    EXTRACT(YEAR   FROM b.end_at AT TIME ZONE v_timezone)::INT AS end_year,
    EXTRACT(MONTH  FROM b.end_at AT TIME ZONE v_timezone)::INT AS end_month,
    EXTRACT(DAY    FROM b.end_at AT TIME ZONE v_timezone)::INT AS end_day,
    EXTRACT(HOUR   FROM b.end_at AT TIME ZONE v_timezone)::INT AS end_hour,
    EXTRACT(MINUTE FROM b.end_at AT TIME ZONE v_timezone)::INT AS end_minute
  FROM staff_calendar_blocks b
  WHERE b.staff_id = p_staff_id
    AND b.end_at >= p_from_date
  ORDER BY b.start_at ASC;
END;
$$;