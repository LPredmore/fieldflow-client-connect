-- Phase 3: Enable RLS and Create Secure Policies (CORRECTED)

BEGIN;

-- ===== ENABLE RLS ON CORE TABLES =====
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinicians ENABLE ROW LEVEL SECURITY;

-- ===== PROFILES TABLE POLICIES =====

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Admins can update profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Allow user creation during signup" ON public.profiles;
DROP POLICY IF EXISTS "Archived users can view their own data" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create NEW secure policies

-- 1. Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO public
USING (user_id = auth.uid());

-- 2. Users can update their own profile (role protection via trigger below)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO public
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Admins can view all profiles in tenant
CREATE POLICY "Admins can view tenant profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id_safe(auth.uid()) AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Admins can update profiles in tenant
CREATE POLICY "Admins can update tenant profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  tenant_id = get_user_tenant_id_safe(auth.uid()) AND
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  tenant_id = get_user_tenant_id_safe(auth.uid()) AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- 5. Allow profile creation during signup
CREATE POLICY "Allow signup profile creation"
ON public.profiles
FOR INSERT
TO public
WITH CHECK (user_id = auth.uid());

-- 6. Archived users can view their own data
CREATE POLICY "Archived users can view own data"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND archived = true);

-- ===== CLINICIANS TABLE POLICIES =====

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Admins can update clinicians in tenant" ON public.clinicians;
DROP POLICY IF EXISTS "Admins can view all clinicians in tenant" ON public.clinicians;
DROP POLICY IF EXISTS "Clinicians can manage their own record" ON public.clinicians;
DROP POLICY IF EXISTS "Prevent privilege escalation on is_admin" ON public.clinicians;
DROP POLICY IF EXISTS "Tenant users can view clinicians" ON public.clinicians;

-- Create NEW secure policies

-- 1. Clinicians can view their own record
CREATE POLICY "Clinicians view own record"
ON public.clinicians
FOR SELECT
TO public
USING (user_id = auth.uid());

-- 2. Clinicians can update their own record (is_admin protection via trigger below)
CREATE POLICY "Clinicians update own record"
ON public.clinicians
FOR UPDATE
TO public
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Admins can view all clinicians in tenant
CREATE POLICY "Admins view tenant clinicians"
ON public.clinicians
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id_safe(auth.uid()) AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Admins can update clinicians in tenant
CREATE POLICY "Admins update tenant clinicians"
ON public.clinicians
FOR UPDATE
TO authenticated
USING (
  tenant_id = get_user_tenant_id_safe(auth.uid()) AND
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  tenant_id = get_user_tenant_id_safe(auth.uid()) AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- 5. Tenant staff can view clinicians (for assignments)
CREATE POLICY "Staff view tenant clinicians"
ON public.clinicians
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id_safe(auth.uid()) AND
  (has_role(auth.uid(), 'staff'::app_role) OR 
   has_role(auth.uid(), 'clinician'::app_role))
);

-- 6. Allow clinician creation during signup (CRITICAL for signup flow)
CREATE POLICY "Allow signup clinician creation"
ON public.clinicians
FOR INSERT
TO public
WITH CHECK (user_id = auth.uid());

-- ===== TRIGGERS TO PREVENT ROLE COLUMN UPDATES =====

-- Prevent direct updates to profiles.role (deprecated column)
CREATE OR REPLACE FUNCTION prevent_profile_role_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins to update roles (for backward compatibility during migration)
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  
  -- Prevent non-admin users from changing role
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Direct role updates are disabled. Use user_roles table instead.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_updates_trigger ON public.profiles;
CREATE TRIGGER prevent_profile_role_updates_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_profile_role_updates();

-- Prevent direct updates to clinicians.is_admin and is_clinician (deprecated columns)
CREATE OR REPLACE FUNCTION prevent_clinician_role_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins to update roles (for backward compatibility during migration)
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  
  -- Prevent non-admin users from changing is_admin or is_clinician
  IF OLD.is_admin IS DISTINCT FROM NEW.is_admin THEN
    RAISE EXCEPTION 'Direct is_admin updates are disabled. Use user_roles table instead.';
  END IF;
  
  IF OLD.is_clinician IS DISTINCT FROM NEW.is_clinician THEN
    RAISE EXCEPTION 'Direct is_clinician updates are disabled. Use user_roles table instead.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_clinician_role_updates_trigger ON public.clinicians;
CREATE TRIGGER prevent_clinician_role_updates_trigger
  BEFORE UPDATE ON public.clinicians
  FOR EACH ROW
  EXECUTE FUNCTION prevent_clinician_role_updates();

-- Add deprecation comments
COMMENT ON COLUMN public.profiles.role IS 'DEPRECATED: Use user_roles table instead. Protected by trigger. Will be removed in v2.0';
COMMENT ON COLUMN public.clinicians.is_admin IS 'DEPRECATED: Use user_roles table instead. Protected by trigger. Will be removed in v2.0';
COMMENT ON COLUMN public.clinicians.is_clinician IS 'DEPRECATED: Use user_roles table instead. Protected by trigger. Will be removed in v2.0';

COMMIT;