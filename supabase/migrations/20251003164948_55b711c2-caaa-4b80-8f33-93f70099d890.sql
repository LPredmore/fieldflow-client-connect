-- Phase 1: Add new columns to clinicians table
ALTER TABLE public.clinicians 
ADD COLUMN IF NOT EXISTS is_clinician BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Phase 2: Migrate existing data
UPDATE public.clinicians c
SET is_admin = true
FROM public.profiles p
WHERE c.user_id = p.user_id AND p.role = 'business_admin';

-- Phase 3: Drop ALL policies that reference the role column
DROP POLICY IF EXISTS "Contractors can manage appointment occurrences" ON public.appointment_occurrences;
DROP POLICY IF EXISTS "Contractors can manage appointment series" ON public.appointment_series;
DROP POLICY IF EXISTS "Business admins can view all clinicians in tenant" ON public.clinicians;
DROP POLICY IF EXISTS "Business admins can update clinicians in tenant" ON public.clinicians;
DROP POLICY IF EXISTS "Business admins can delete tenant license types" ON public.cliniclevel_license_types;
DROP POLICY IF EXISTS "Business admins can insert license types" ON public.cliniclevel_license_types;
DROP POLICY IF EXISTS "Business admins can view tenant license types" ON public.cliniclevel_license_types;
DROP POLICY IF EXISTS "Contractors can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Contractors can manage form assignments" ON public.form_assignments;
DROP POLICY IF EXISTS "Contractors can manage form fields" ON public.form_fields;
DROP POLICY IF EXISTS "Contractors can insert form responses" ON public.form_responses;
DROP POLICY IF EXISTS "Contractors can view form responses" ON public.form_responses;
DROP POLICY IF EXISTS "Contractors can manage form templates" ON public.form_templates;
DROP POLICY IF EXISTS "Contractors can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Contractors can manage services" ON public.services;
DROP POLICY IF EXISTS "Business admins can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Business admins can manage user permissions" ON public.user_permissions;

-- Phase 4: Update the user_role enum
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;

CREATE TYPE user_role_new AS ENUM ('staff', 'client');

ALTER TABLE public.profiles 
ALTER COLUMN role TYPE user_role_new 
USING (
  CASE 
    WHEN role IN ('business_admin', 'contractor') THEN 'staff'::user_role_new
    ELSE 'client'::user_role_new
  END
);

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'staff'::user_role_new;

DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;

-- Phase 5: Create security definer function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinicians
    WHERE user_id = _user_id
      AND is_admin = true
  )
$$;

-- Phase 6: Update handle_client_signup function
CREATE OR REPLACE FUNCTION public.handle_client_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    user_meta JSONB;
    fixed_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    computed_full_name TEXT;
BEGIN
    user_meta := NEW.raw_user_meta_data;
    
    computed_full_name := TRIM(CONCAT(
        COALESCE(user_meta->>'first_name', ''), 
        ' ', 
        COALESCE(user_meta->>'last_name', '')
    ));
    
    IF user_meta->>'user_type' = 'client' THEN
        INSERT INTO public.profiles (
            user_id, tenant_id, role, first_name, last_name, full_name, phone, email, company_name
        ) VALUES (
            NEW.id, fixed_tenant_id, 'client',
            user_meta->>'first_name', user_meta->>'last_name', computed_full_name,
            user_meta->>'phone', NEW.email, user_meta->>'company_name'
        );
        
        INSERT INTO public.customers (
            tenant_id, client_user_id, name, phone, email, status
        ) VALUES (
            fixed_tenant_id, NEW.id, computed_full_name,
            user_meta->>'phone', NEW.email, 'new'
        );
        
    ELSIF user_meta->>'user_type' = 'contractor' THEN
        INSERT INTO public.profiles (
            user_id, tenant_id, role, first_name, last_name, full_name, phone, email, company_name
        ) VALUES (
            NEW.id, fixed_tenant_id, 'staff',
            user_meta->>'first_name', user_meta->>'last_name', computed_full_name,
            user_meta->>'phone', NEW.email, user_meta->>'company_name'
        );
        
        INSERT INTO public.clinicians (
            user_id, tenant_id, clinician_status, is_clinician, is_admin
        ) VALUES (
            NEW.id, fixed_tenant_id, 'New', true, true
        );
        
        INSERT INTO public.settings (
            tenant_id, created_by_user_id, business_name, business_email
        ) VALUES (
            fixed_tenant_id, NEW.id, user_meta->>'company_name', NEW.email
        ) ON CONFLICT (tenant_id) DO NOTHING;
        
        INSERT INTO public.user_permissions (
            tenant_id, user_id,
            access_appointments, access_services, access_invoicing, access_forms,
            access_calendar, supervisor
        ) VALUES (
            fixed_tenant_id, NEW.id,
            true, true, true, true, true, true
        );
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Phase 7: Recreate all RLS policies with new role system
CREATE POLICY "Staff can manage appointment occurrences"
ON public.appointment_occurrences FOR ALL TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'staff')
);

CREATE POLICY "Staff can manage appointment series"
ON public.appointment_series FOR ALL TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'staff')
);

CREATE POLICY "Admins can view all clinicians in tenant"
ON public.clinicians FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can update clinicians in tenant"
ON public.clinicians FOR UPDATE TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Prevent privilege escalation on is_admin"
ON public.clinicians FOR UPDATE TO authenticated
USING (true)
WITH CHECK (
  public.is_admin(auth.uid()) = true
  OR (is_admin = false OR is_admin = (SELECT c.is_admin FROM clinicians c WHERE c.id = clinicians.id))
);

CREATE POLICY "Admins can manage license types"
ON public.cliniclevel_license_types FOR ALL TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Staff can manage customers"
ON public.customers FOR ALL TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'staff')
);

CREATE POLICY "Staff can manage form assignments"
ON public.form_assignments FOR ALL TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'staff')
);

CREATE POLICY "Staff can manage form fields"
ON public.form_fields FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM form_templates ft
    WHERE ft.id = form_fields.form_template_id
      AND ft.tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
      AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'staff')
  )
);

CREATE POLICY "Staff can insert form responses"
ON public.form_responses FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM form_templates ft
    WHERE ft.id = form_responses.form_template_id
      AND ft.tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
      AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'staff')
  )
);

CREATE POLICY "Staff can view form responses"
ON public.form_responses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM form_templates ft
    WHERE ft.id = form_responses.form_template_id
      AND ft.tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Staff can manage form templates"
ON public.form_templates FOR ALL TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'staff')
);

CREATE POLICY "Staff can manage invoices"
ON public.invoices FOR ALL TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'staff')
);

CREATE POLICY "Staff can manage services"
ON public.services FOR ALL TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'staff')
);

CREATE POLICY "Admins can manage settings"
ON public.settings FOR ALL TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can manage user permissions"
ON public.user_permissions FOR ALL TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND public.is_admin(auth.uid())
);