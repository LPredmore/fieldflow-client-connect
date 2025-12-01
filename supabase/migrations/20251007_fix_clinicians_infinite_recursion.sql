-- Fix Clinicians Table Infinite Recursion
-- This migration addresses the circular reference between the is_admin() function
-- and the clinicians table policies that was causing infinite recursion errors.

-- Step 1: Drop existing problematic policies
DROP POLICY IF EXISTS "Clinicians can manage their own record" ON public.clinicians;
DROP POLICY IF EXISTS "Business admins can view all clinicians in tenant" ON public.clinicians;
DROP POLICY IF EXISTS "Tenant users can view clinicians" ON public.clinicians;
DROP POLICY IF EXISTS "Admins can view all clinicians in tenant" ON public.clinicians;
DROP POLICY IF EXISTS "Admins can update clinicians in tenant" ON public.clinicians;
DROP POLICY IF EXISTS "Prevent privilege escalation on is_admin" ON public.clinicians;

-- Step 2: Drop the problematic is_admin function that creates circular reference
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- Step 3: Create new simplified policies using direct auth.uid() comparisons
-- These policies eliminate circular references by using direct authentication

-- Policy: Users can manage their own clinician record
CREATE POLICY "Users can manage own clinician record"
ON public.clinicians
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy: Users can view clinicians in their tenant (simplified)
CREATE POLICY "Users can view tenant clinicians"
ON public.clinicians
FOR SELECT
TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);

-- Policy: Business admins can manage all clinicians in their tenant
-- This uses a direct role check instead of the problematic is_admin() function
CREATE POLICY "Business admins can manage tenant clinicians"
ON public.clinicians
FOR ALL
TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'business_admin'
  )
)
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'business_admin'
  )
);

-- Policy: Prevent privilege escalation on is_admin field
-- This policy ensures only business_admins can set is_admin = true
CREATE POLICY "Prevent is_admin privilege escalation"
ON public.clinicians
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  -- Allow updates that don't change is_admin
  (is_admin = (SELECT c.is_admin FROM clinicians c WHERE c.id = clinicians.id))
  OR
  -- Allow business_admins to change is_admin
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'business_admin'
    AND tenant_id = clinicians.tenant_id
  ))
);

-- Step 4: Create a new is_admin helper function that doesn't create circular references
-- This function uses the profiles table directly instead of the clinicians table
CREATE OR REPLACE FUNCTION public.is_business_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND role = 'business_admin'
  )
$$;

-- Step 5: Update any other functions that might have used the old is_admin function
-- Update handle_client_signup function to use the new approach
CREATE OR REPLACE FUNCTION public.handle_client_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Create profile record
    INSERT INTO public.profiles (
        user_id, 
        tenant_id, 
        role, 
        first_name, 
        last_name, 
        email
    ) VALUES (
        NEW.id, 
        NEW.raw_user_meta_data->>'tenant_id', 
        COALESCE(NEW.raw_user_meta_data->>'role', 'client'), 
        NEW.raw_user_meta_data->>'first_name', 
        NEW.raw_user_meta_data->>'last_name', 
        NEW.email
    );

    -- Create clinician record for business_admin and contractor roles
    IF NEW.raw_user_meta_data->>'role' IN ('business_admin', 'contractor') THEN
        INSERT INTO public.clinicians (
            user_id, 
            tenant_id, 
            clinician_status, 
            is_clinician, 
            is_admin
        ) VALUES (
            NEW.id,
            NEW.raw_user_meta_data->>'tenant_id',
            'active',
            true,
            CASE WHEN NEW.raw_user_meta_data->>'role' = 'business_admin' THEN true ELSE false END
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Add comment explaining the fix
COMMENT ON POLICY "Users can manage own clinician record" ON public.clinicians IS 
'Allows users to manage their own clinician record using direct auth.uid() comparison to avoid circular references';

COMMENT ON POLICY "Business admins can manage tenant clinicians" ON public.clinicians IS 
'Allows business admins to manage all clinicians in their tenant using direct role check from profiles table to avoid circular references';

COMMENT ON FUNCTION public.is_business_admin(uuid) IS 
'Helper function to check if a user is a business admin. Uses profiles table directly to avoid circular references with clinicians table policies';
--
 Step 6: Add/Update indexes for efficient policy evaluation
-- These indexes ensure the new policies perform well

-- Ensure user_id index exists on clinicians table (should already exist)
CREATE INDEX IF NOT EXISTS idx_clinicians_user_id ON public.clinicians(user_id);

-- Ensure tenant_id index exists on clinicians table (should already exist)  
CREATE INDEX IF NOT EXISTS idx_clinicians_tenant_id ON public.clinicians(tenant_id);

-- Add composite index for tenant_id + user_id lookups (common in policies)
CREATE INDEX IF NOT EXISTS idx_clinicians_tenant_user ON public.clinicians(tenant_id, user_id);

-- Add index on is_admin field for admin privilege checks
CREATE INDEX IF NOT EXISTS idx_clinicians_is_admin ON public.clinicians(is_admin) WHERE is_admin = true;

-- Ensure profiles table has efficient indexes for policy evaluation
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Add composite index for tenant + role lookups (used in business_admin checks)
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role ON public.profiles(tenant_id, role);

-- Add composite index for user + role lookups (used in policy evaluation)
CREATE INDEX IF NOT EXISTS idx_profiles_user_role ON public.profiles(user_id, role);

-- Add comments explaining the indexes
COMMENT ON INDEX idx_clinicians_tenant_user IS 'Composite index for efficient tenant-scoped user lookups in RLS policies';
COMMENT ON INDEX idx_clinicians_is_admin IS 'Partial index for efficient admin privilege checks, only indexes true values';
COMMENT ON INDEX idx_profiles_tenant_role IS 'Composite index for efficient business admin checks in RLS policies';
COMMENT ON INDEX idx_profiles_user_role IS 'Composite index for efficient user role validation in RLS policies';