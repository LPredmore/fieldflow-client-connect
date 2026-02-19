
-- 1. Add columns to staff table
ALTER TABLE public.staff
  ADD COLUMN prov_self_scheduling_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN prov_scheduling_interval_minutes integer NOT NULL DEFAULT 60;

-- 2. Validation trigger (not CHECK constraint per project guidelines)
CREATE OR REPLACE FUNCTION public.validate_scheduling_interval()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.prov_scheduling_interval_minutes NOT IN (30, 60) THEN
    RAISE EXCEPTION 'prov_scheduling_interval_minutes must be 30 or 60, got %', NEW.prov_scheduling_interval_minutes;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_scheduling_interval
  BEFORE INSERT OR UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.validate_scheduling_interval();

-- 3. Update get_available_appointment_slots to use dynamic interval
CREATE OR REPLACE FUNCTION public.get_available_appointment_slots(p_staff_id uuid, p_client_timezone text, p_target_date date, p_duration_minutes integer DEFAULT 60)
 RETURNS TABLE(slot_start_utc timestamp with time zone, slot_end_utc timestamp with time zone, display_date text, display_time text, display_end_time text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_staff_tz TEXT;
  v_day_start_utc TIMESTAMPTZ;
  v_day_end_utc TIMESTAMPTZ;
  v_interval_minutes INTEGER;
BEGIN
  -- 1. Get staff timezone and scheduling interval
  SELECT COALESCE(s.prov_time_zone::TEXT, 'America/New_York'),
         COALESCE(s.prov_scheduling_interval_minutes, 60)
  INTO v_staff_tz, v_interval_minutes
  FROM staff s WHERE s.id = p_staff_id;

  IF v_staff_tz IS NULL THEN
    RETURN; -- staff not found
  END IF;

  -- 2. UTC boundaries for the client's selected date
  v_day_start_utc := p_target_date::TIMESTAMP AT TIME ZONE p_client_timezone;
  v_day_end_utc   := (p_target_date + 1)::TIMESTAMP AT TIME ZONE p_client_timezone;

  RETURN QUERY
  WITH
  -- Availability windows: staff TIME ranges converted to UTC timestamps
  avail_windows AS (
    SELECT
      (d.dt + sas.start_time) AT TIME ZONE v_staff_tz AS window_start_utc,
      (d.dt + sas.end_time)   AT TIME ZONE v_staff_tz AS window_end_utc
    FROM staff_availability_schedules sas
    CROSS JOIN LATERAL (
      SELECT generate_series(
        (v_day_start_utc AT TIME ZONE v_staff_tz)::DATE,
        (v_day_end_utc   AT TIME ZONE v_staff_tz)::DATE,
        '1 day'::INTERVAL
      )::DATE AS dt
    ) d
    WHERE sas.staff_id  = p_staff_id
      AND sas.is_active = true
      AND EXTRACT(DOW FROM d.dt) = sas.day_of_week
  ),
  -- Candidate slots using the staff's configured interval
  candidate_slots AS (
    SELECT
      gs AS candidate_start,
      gs + (p_duration_minutes || ' minutes')::INTERVAL AS candidate_end
    FROM avail_windows aw
    CROSS JOIN LATERAL generate_series(
      aw.window_start_utc,
      aw.window_end_utc - (p_duration_minutes || ' minutes')::INTERVAL,
      (v_interval_minutes || ' minutes')::INTERVAL
    ) gs
    WHERE gs >= v_day_start_utc
      AND gs <  v_day_end_utc
      AND gs + (p_duration_minutes || ' minutes')::INTERVAL <= aw.window_end_utc
      AND gs >= NOW()
  ),
  -- Remove conflicts
  filtered_slots AS (
    SELECT cs.candidate_start, cs.candidate_end
    FROM candidate_slots cs
    WHERE NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.staff_id = p_staff_id
        AND a.status != 'cancelled'
        AND a.start_at < cs.candidate_end
        AND a.end_at   > cs.candidate_start
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_calendar_blocks scb
      WHERE scb.staff_id = p_staff_id
        AND scb.start_at < cs.candidate_end
        AND scb.end_at   > cs.candidate_start
    )
  )
  SELECT
    fs.candidate_start AS slot_start_utc,
    fs.candidate_end   AS slot_end_utc,
    TO_CHAR(fs.candidate_start AT TIME ZONE p_client_timezone, 'FMDay, FMMonth DD, YYYY') AS display_date,
    TO_CHAR(fs.candidate_start AT TIME ZONE p_client_timezone, 'FMHH12:MI AM')            AS display_time,
    TO_CHAR(fs.candidate_end   AT TIME ZONE p_client_timezone, 'FMHH12:MI AM')            AS display_end_time
  FROM filtered_slots fs
  ORDER BY fs.candidate_start;
END;
$function$;
