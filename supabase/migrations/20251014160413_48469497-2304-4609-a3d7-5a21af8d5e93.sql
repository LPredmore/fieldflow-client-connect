-- Create security definer function to safely get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Drop and recreate problematic policies on profiles table
DROP POLICY IF EXISTS "Admins can update profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Tenant users can view clinicians" ON public.clinicians;

-- Recreate profiles admin update policy using the safe function
CREATE POLICY "Admins can update profiles in their tenant" ON public.profiles
FOR UPDATE 
USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) 
  AND public.is_admin(auth.uid())
);

-- Recreate clinicians view policy using the safe function
CREATE POLICY "Tenant users can view clinicians" ON public.clinicians
FOR SELECT 
USING (tenant_id = public.get_user_tenant_id(auth.uid()));