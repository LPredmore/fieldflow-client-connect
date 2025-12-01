-- Drop existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop existing function
DROP FUNCTION IF EXISTS public.handle_client_signup();

-- Recreate the function with inviter data support
CREATE OR REPLACE FUNCTION public.handle_client_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    user_meta JSONB;
    fixed_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    actual_tenant_id UUID;
    computed_full_name TEXT;
    company_name_value TEXT;
    avatar_url_value TEXT;
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
        -- Extract inviter's tenant_id, company_name, and avatar_url
        actual_tenant_id := COALESCE(
            (user_meta->>'inviter_tenant_id')::UUID,
            fixed_tenant_id
        );
        company_name_value := user_meta->>'inviter_company_name';
        avatar_url_value := user_meta->>'inviter_avatar_url';
        
        INSERT INTO public.profiles (
            user_id, tenant_id, role, first_name, last_name, full_name, phone, email, company_name, avatar_url
        ) VALUES (
            NEW.id, actual_tenant_id, 'staff',
            user_meta->>'first_name', user_meta->>'last_name', computed_full_name,
            user_meta->>'phone', NEW.email, company_name_value, avatar_url_value
        );
        
        INSERT INTO public.clinicians (
            user_id, 
            tenant_id, 
            clinician_status, 
            is_clinician, 
            is_admin,
            clinician_field,
            clinician_npi_number,
            clinician_licensed_states,
            clinician_license_type,
            clinician_license_number,
            clinician_taxonomy_code
        ) VALUES (
            NEW.id, 
            actual_tenant_id, 
            'New',
            true, 
            COALESCE((user_meta->>'is_admin')::boolean, false),
            CASE 
                WHEN user_meta->>'clinician_field' IS NOT NULL 
                THEN ARRAY[user_meta->>'clinician_field']
                ELSE NULL
            END,
            user_meta->>'clinician_npi_number',
            CASE 
                WHEN user_meta->>'primary_state' IS NOT NULL 
                THEN ARRAY[(user_meta->>'primary_state')::us_states]
                ELSE NULL
            END,
            user_meta->>'clinician_license_type',
            user_meta->>'clinician_license_number',
            user_meta->>'clinician_taxonomy_code'
        );
        
        INSERT INTO public.settings (
            tenant_id, created_by_user_id, business_name, business_email
        ) VALUES (
            actual_tenant_id, NEW.id, company_name_value, NEW.email
        ) ON CONFLICT (tenant_id) DO NOTHING;
        
        INSERT INTO public.user_permissions (
            tenant_id, user_id,
            access_appointments, access_services, access_invoicing, access_forms,
            access_calendar, supervisor
        ) VALUES (
            actual_tenant_id, NEW.id,
            true, true, true, true, true, COALESCE((user_meta->>'is_admin')::boolean, false)
        );
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_client_signup();

-- Add RLS policy to allow admins to update all profiles in their tenant
CREATE POLICY "Admins can update profiles in their tenant"
ON public.profiles
FOR UPDATE
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND is_admin(auth.uid())
);