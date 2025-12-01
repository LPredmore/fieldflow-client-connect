-- Create yes_or_no enum if not exists
DO $$ BEGIN
    CREATE TYPE yes_or_no AS ENUM ('Yes', 'No');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create clinician_status_enum if not exists
DO $$ BEGIN
    CREATE TYPE clinician_status_enum AS ENUM ('New', 'Active', 'Inactive', 'On Leave');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create clinician_field enum if not exists
DO $$ BEGIN
    CREATE TYPE clinician_field AS ENUM ('Psychology', 'Psychiatry', 'Social Work', 'Counseling', 'Therapy', 'Other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the clinicians table
CREATE TABLE public.clinicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(user_id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  
  -- Profile & bio fields
  clinician_bio text,
  clinician_treatment_approaches text[],
  clinician_min_client_age integer DEFAULT 18,
  clinician_accepting_new_clients yes_or_no,
  
  -- Professional credentials & field
  clinician_field clinician_field[],
  clinician_license_type text,
  clinician_npi_number text,
  clinician_taxonomy_code text,
  
  -- Naming fields
  clinician_client_name text,
  clinician_nameinsurance text,
  
  -- Licensing & status
  clinician_licensed_states us_states[],
  clinician_status clinician_status_enum DEFAULT 'New',
  
  -- Media & security
  clinician_image_url text,
  clinician_temppassword text,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE public.clinicians IS 'Extended profile information for business_admin and contractor users';
COMMENT ON COLUMN public.clinicians.clinician_client_name IS 'Display name shown to clients (may include professional suffix titles like PhD, LCSW)';
COMMENT ON COLUMN public.clinicians.clinician_nameinsurance IS 'Legal name used for insurance submissions (may differ from legal name due to marriage, etc.)';
COMMENT ON COLUMN public.clinicians.clinician_license_type IS 'Must match a value from cliniclevel_license_types.license column';
COMMENT ON COLUMN public.clinicians.clinician_licensed_states IS 'Array of US state codes where clinician is licensed (optional field)';

-- Create indexes for performance
CREATE INDEX idx_clinicians_user_id ON public.clinicians(user_id);
CREATE INDEX idx_clinicians_tenant_id ON public.clinicians(tenant_id);
CREATE INDEX idx_clinicians_licensed_states ON public.clinicians USING GIN(clinician_licensed_states);
CREATE INDEX idx_clinicians_field ON public.clinicians USING GIN(clinician_field);
CREATE INDEX idx_clinicians_status ON public.clinicians(clinician_status);

-- Enable Row Level Security
ALTER TABLE public.clinicians ENABLE ROW LEVEL SECURITY;

-- Policy: Clinicians can manage their own record
CREATE POLICY "Clinicians can manage their own record"
ON public.clinicians
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy: Business admins can view all clinicians in their tenant
CREATE POLICY "Business admins can view all clinicians in tenant"
ON public.clinicians
FOR SELECT
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'business_admin'
  )
);

-- Policy: Tenant users can view clinicians
CREATE POLICY "Tenant users can view clinicians"
ON public.clinicians
FOR SELECT
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER set_clinicians_updated_at
BEFORE UPDATE ON public.clinicians
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Update handle_client_signup function to create clinician records
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
    
    -- Process client signup
    IF user_meta->>'user_type' = 'client' THEN
        INSERT INTO public.profiles (
            user_id, tenant_id, role, first_name, last_name, full_name, phone, email, company_name
        ) VALUES (
            NEW.id, fixed_tenant_id, 'client',
            user_meta->>'first_name', user_meta->>'last_name', computed_full_name,
            user_meta->>'phone', NEW.email, user_meta->>'company_name'
        );
        
        INSERT INTO public.customers (
            tenant_id, client_user_id, name, customer_type, phone, email, profile_completed, status
        ) VALUES (
            fixed_tenant_id, NEW.id, computed_full_name, 'residential',
            user_meta->>'phone', NEW.email, false, 'new'
        );
        
    ELSIF user_meta->>'user_type' = 'contractor' THEN
        -- Insert into profiles for contractor
        INSERT INTO public.profiles (
            user_id, tenant_id, role, first_name, last_name, full_name, phone, email, company_name
        ) VALUES (
            NEW.id, fixed_tenant_id, 'business_admin',
            user_meta->>'first_name', user_meta->>'last_name', computed_full_name,
            user_meta->>'phone', NEW.email, user_meta->>'company_name'
        );
        
        -- Create clinician record for contractor/business_admin
        INSERT INTO public.clinicians (
            user_id, tenant_id, clinician_status
        ) VALUES (
            NEW.id, fixed_tenant_id, 'New'
        );
        
        INSERT INTO public.settings (
            tenant_id, created_by_user_id, business_name, business_email
        ) VALUES (
            fixed_tenant_id, NEW.id, user_meta->>'company_name', NEW.email
        ) ON CONFLICT (tenant_id) DO NOTHING;
        
        INSERT INTO public.user_permissions (
            tenant_id, user_id,
            access_jobs, access_customers, access_services, access_quotes,
            access_invoicing, access_calendar, access_settings, access_user_management
        ) VALUES (
            fixed_tenant_id, NEW.id,
            true, true, true, true, true, true, true, true
        );
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create clinician record for existing business_admin user
INSERT INTO public.clinicians (
    user_id, 
    tenant_id,
    clinician_status
)
SELECT 
    user_id,
    tenant_id,
    'New'::clinician_status_enum
FROM public.profiles
WHERE user_id = 'e6d86a7c-2176-4f32-a697-814ca14cc16c'
AND role IN ('business_admin', 'contractor')
ON CONFLICT (user_id) DO NOTHING;