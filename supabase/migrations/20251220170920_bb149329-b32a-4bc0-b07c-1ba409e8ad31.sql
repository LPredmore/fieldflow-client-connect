-- Create RPC function for staff calendar appointments with server-side timezone conversion
-- This function looks up prov_time_zone from the staff table and returns pre-formatted display strings

CREATE OR REPLACE FUNCTION public.get_staff_calendar_appointments(
  p_staff_id uuid,
  p_from_date timestamptz DEFAULT now() - interval '7 days',
  p_to_date timestamptz DEFAULT now() + interval '90 days'
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  series_id uuid,
  client_id uuid,
  staff_id uuid,
  service_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  is_telehealth boolean,
  location_name text,
  time_zone text,
  created_at timestamptz,
  updated_at timestamptz,
  client_name text,
  service_name text,
  clinician_name text,
  display_date text,
  display_time text,
  display_end_time text,
  display_timezone text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    v_timezone AS display_timezone
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
$$;