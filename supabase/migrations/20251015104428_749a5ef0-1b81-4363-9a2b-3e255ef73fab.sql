-- Fix RPC function overloading issue
-- Step 1: Drop the parameterized version with CASCADE to remove dependent policies
DROP FUNCTION IF EXISTS public.get_user_tenant_id(uuid) CASCADE;

-- Step 2: Recreate the RLS policies that were dropped, now using the parameterless version

-- Recreate "Admins can update profiles in their tenant" policy on profiles table
CREATE POLICY "Admins can update profiles in their tenant"
ON public.profiles
FOR UPDATE
USING (
  (tenant_id = get_user_tenant_id()) AND is_admin(auth.uid())
);

-- Recreate "Tenant users can view clinicians" policy on clinicians table
CREATE POLICY "Tenant users can view clinicians"
ON public.clinicians
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
);

-- Step 3: Add a comment to document the remaining function
COMMENT ON FUNCTION public.get_user_tenant_id() IS 
  'Returns the tenant_id for the currently authenticated user. Uses auth.uid() internally to identify the user. This is the only version of this function - the parameterized version was removed to fix RPC overloading issues.';