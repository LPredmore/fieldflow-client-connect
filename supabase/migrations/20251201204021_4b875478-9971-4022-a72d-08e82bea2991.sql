-- Drop and recreate the setup_admin_user function with correct column names
DROP FUNCTION IF EXISTS public.setup_admin_user(text,text,text,text,text,text,text);

CREATE FUNCTION public.setup_admin_user(
  _user_email text,
  _first_name text DEFAULT NULL::text,
  _last_name text DEFAULT NULL::text,
  _license_type text DEFAULT NULL::text,
  _license_number text DEFAULT NULL::text,
  _npi text DEFAULT NULL::text,
  _taxonomy text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _tenant_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  _staff_id uuid;
  _account_owner_role_id uuid;
  _clinician_role_id uuid;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO _user_id
  FROM auth.users
  WHERE email = _user_email;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', _user_email;
  END IF;

  -- Create tenant membership
  INSERT INTO public.tenant_memberships (tenant_id, profile_id, tenant_role, created_at)
  VALUES (_tenant_id, _user_id, 'owner', now())
  ON CONFLICT (tenant_id, profile_id) DO NOTHING;

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (_user_id, 'admin'::app_role, now())
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create staff record
  INSERT INTO public.staff (
    id,
    tenant_id,
    profile_id,
    prov_name_f,
    prov_name_l,
    prov_license_type,
    prov_license_number,
    prov_npi,
    prov_taxonomy,
    prov_status,
    prov_accepting_new_clients,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    _tenant_id,
    _user_id,
    COALESCE(_first_name, 'Admin'),
    COALESCE(_last_name, 'User'),
    _license_type,
    _license_number,
    _npi,
    _taxonomy,
    'active',
    true,
    now(),
    now()
  )
  ON CONFLICT (profile_id, tenant_id) DO UPDATE
  SET 
    prov_name_f = COALESCE(_first_name, staff.prov_name_f),
    prov_name_l = COALESCE(_last_name, staff.prov_name_l),
    prov_license_type = COALESCE(_license_type, staff.prov_license_type),
    prov_license_number = COALESCE(_license_number, staff.prov_license_number),
    prov_npi = COALESCE(_npi, staff.prov_npi),
    prov_taxonomy = COALESCE(_taxonomy, staff.prov_taxonomy),
    updated_at = now()
  RETURNING id INTO _staff_id;

  -- Get staff role IDs
  SELECT id INTO _account_owner_role_id FROM public.staff_roles WHERE code = 'ACCOUNT_OWNER';
  SELECT id INTO _clinician_role_id FROM public.staff_roles WHERE code = 'CLINICIAN';

  -- Assign ACCOUNT_OWNER role
  INSERT INTO public.staff_role_assignments (tenant_id, staff_id, staff_role_id, created_at, updated_at)
  VALUES (_tenant_id, _staff_id, _account_owner_role_id, now(), now())
  ON CONFLICT DO NOTHING;

  -- Assign CLINICIAN role
  INSERT INTO public.staff_role_assignments (tenant_id, staff_id, staff_role_id, created_at, updated_at)
  VALUES (_tenant_id, _staff_id, _clinician_role_id, now(), now())
  ON CONFLICT DO NOTHING;

  RETURN _user_id;
END;
$function$;

-- Now set up the existing admin user
SELECT public.setup_admin_user('info@valorwell.org', 'Admin', 'User');