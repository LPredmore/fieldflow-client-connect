-- Phase 8: Initial Admin Setup for ValorWell Tenant
-- This migration sets up the initial tenant and staff role structure

-- 1. Create the ValorWell tenant
INSERT INTO public.tenants (id, name, slug, display_name, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'ValorWell',
  'valorwell',
  'ValorWell Healthcare',
  true,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure core staff roles exist
INSERT INTO public.staff_roles (id, code, name, description, is_clinical, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'ACCOUNT_OWNER', 'Account Owner', 'Full administrative access to all system features', false, now(), now()),
  (gen_random_uuid(), 'CLINICIAN', 'Clinician', 'Clinical staff with patient care responsibilities', true, now(), now()),
  (gen_random_uuid(), 'SUPERVISOR', 'Clinical Supervisor', 'Supervises other clinicians and reviews clinical work', true, now(), now()),
  (gen_random_uuid(), 'BILLING', 'Billing Specialist', 'Manages billing and insurance claims', false, now(), now())
ON CONFLICT (code) DO NOTHING;

-- 3. Create a helper function to set up an admin user
-- This function should be called after a user signs up
CREATE OR REPLACE FUNCTION public.setup_admin_user(
  _user_email text,
  _first_name text DEFAULT NULL,
  _last_name text DEFAULT NULL,
  _license_type text DEFAULT NULL,
  _license_number text DEFAULT NULL,
  _npi text DEFAULT NULL,
  _taxonomy_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    prov_taxonomy_code,
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
    _taxonomy_code,
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
    prov_taxonomy_code = COALESCE(_taxonomy_code, staff.prov_taxonomy_code),
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
$$;

-- 4. Create a trigger to automatically set up new users as staff
-- This trigger runs after a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  _first_name text;
  _last_name text;
BEGIN
  -- Extract name from user metadata if provided
  _first_name := new.raw_user_meta_data->>'first_name';
  _last_name := new.raw_user_meta_data->>'last_name';

  -- Create profile record
  INSERT INTO public.profiles (id, email, password, email_verified, is_active, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    '',  -- Password is managed by auth.users
    new.email_confirmed_at IS NOT NULL,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- If this is the first user (info@valorwell.org), set them up as admin
  IF new.email = 'info@valorwell.org' THEN
    PERFORM setup_admin_user(
      new.email,
      COALESCE(_first_name, 'Admin'),
      COALESCE(_last_name, 'User')
    );
  END IF;

  RETURN new;
END;
$$;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Comment with setup instructions
COMMENT ON FUNCTION public.setup_admin_user IS 
  'Sets up an admin user with full privileges. Call after user signs up: SELECT setup_admin_user(''email@example.com'', ''FirstName'', ''LastName'');';