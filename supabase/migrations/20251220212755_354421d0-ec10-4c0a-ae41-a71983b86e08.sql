-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_staff_calendar_appointments(uuid, timestamp with time zone, timestamp with time zone);

-- Recreate with videoroom_url in return columns
CREATE OR REPLACE FUNCTION public.get_staff_calendar_appointments(p_staff_id uuid, p_from_date timestamp with time zone DEFAULT (now() - '7 days'::interval), p_to_date timestamp with time zone DEFAULT (now() + '90 days'::interval))
 RETURNS TABLE(id uuid, tenant_id uuid, series_id uuid, client_id uuid, staff_id uuid, service_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, status text, is_telehealth boolean, location_name text, time_zone text, created_at timestamp with time zone, updated_at timestamp with time zone, videoroom_url text, client_name text, service_name text, clinician_name text, display_date text, display_time text, display_end_time text, display_timezone text, start_year integer, start_month integer, start_day integer, start_hour integer, start_minute integer, end_hour integer, end_minute integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_timezone TEXT;
  v_tenant_id UUID;
BEGIN
  -- Get staff's timezone and tenant from staff table
  -- Default to America/New_York if prov_time_zone is NULL
  SELECT 
    COALESCE(s.prov_time_zone::TEXT, 'America/New_York'),
    s.tenant_id
  INTO v_timezone, v_tenant_id
  FROM staff s
  WHERE s.id = p_staff_id;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Staff not found: %', p_staff_id;
  END IF;

  RETURN QUERY
  SELECT 
    a.id,
    a.tenant_id,
    a.series_id,
    a.client_id,
    a.staff_id,
    a.service_id,
    a.start_at,
    a.end_at,
    a.status::text,
    a.is_telehealth,
    a.location_name,
    a.time_zone::text,
    a.created_at,
    a.updated_at,
    a.videoroom_url,
    -- Build client name: prefer preferred name, then full name
    COALESCE(
      NULLIF(c.pat_name_preferred, ''),
      NULLIF(CONCAT_WS(' ', c.pat_name_f, c.pat_name_m, c.pat_name_l), ''),
      'Unknown Client'
    ) AS client_name,
    -- Service name
    COALESCE(sv.name, 'Unknown Service') AS service_name,
    -- Clinician name: prefer display name, then full name
    COALESCE(
      NULLIF(st.prov_name_for_clients, ''),
      NULLIF(CONCAT_WS(' ', st.prov_name_f, st.prov_name_l), ''),
      'Unassigned'
    ) AS clinician_name,
    -- Pre-formatted display strings using staff's timezone
    TO_CHAR(a.start_at AT TIME ZONE v_timezone, 'FMDay, FMMonth DD, YYYY') AS display_date,
    TO_CHAR(a.start_at AT TIME ZONE v_timezone, 'FMHH12:MI AM') AS display_time,
    TO_CHAR(a.end_at AT TIME ZONE v_timezone, 'FMHH12:MI AM') AS display_end_time,
    v_timezone AS display_timezone,
    -- Time components for fake local Date construction in staff's timezone
    EXTRACT(YEAR FROM a.start_at AT TIME ZONE v_timezone)::integer AS start_year,
    EXTRACT(MONTH FROM a.start_at AT TIME ZONE v_timezone)::integer AS start_month,
    EXTRACT(DAY FROM a.start_at AT TIME ZONE v_timezone)::integer AS start_day,
    EXTRACT(HOUR FROM a.start_at AT TIME ZONE v_timezone)::integer AS start_hour,
    EXTRACT(MINUTE FROM a.start_at AT TIME ZONE v_timezone)::integer AS start_minute,
    EXTRACT(HOUR FROM a.end_at AT TIME ZONE v_timezone)::integer AS end_hour,
    EXTRACT(MINUTE FROM a.end_at AT TIME ZONE v_timezone)::integer AS end_minute
  FROM appointments a
  LEFT JOIN clients c ON a.client_id = c.id
  LEFT JOIN services sv ON a.service_id = sv.id
  LEFT JOIN staff st ON a.staff_id = st.id
  WHERE a.staff_id = p_staff_id
    AND a.tenant_id = v_tenant_id
    AND a.start_at >= p_from_date
    AND a.start_at < p_to_date
  ORDER BY a.start_at ASC;
END;
$function$;