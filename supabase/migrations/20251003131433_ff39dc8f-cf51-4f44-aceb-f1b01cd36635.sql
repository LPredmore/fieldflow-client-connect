-- Add tenant_id and created_by_user_id columns to cliniclevel_license_types
ALTER TABLE public.cliniclevel_license_types 
ADD COLUMN IF NOT EXISTS tenant_id uuid,
ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

-- Enable RLS
ALTER TABLE public.cliniclevel_license_types ENABLE ROW LEVEL SECURITY;

-- Policy: Business admins can view their tenant's license types
CREATE POLICY "Business admins can view tenant license types"
ON public.cliniclevel_license_types
FOR SELECT
TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Policy: Business admins can insert license types
CREATE POLICY "Business admins can insert license types"
ON public.cliniclevel_license_types
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  ) AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'business_admin'
  )
);

-- Policy: Business admins can delete their tenant's license types
CREATE POLICY "Business admins can delete tenant license types"
ON public.cliniclevel_license_types
FOR DELETE
TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  ) AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'business_admin'
  )
);