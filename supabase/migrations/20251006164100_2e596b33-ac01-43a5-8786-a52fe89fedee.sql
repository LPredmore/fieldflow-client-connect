-- Update handle_client_signup trigger to work with text[] clinician_field
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
        
        -- Insert into clinicians with text[] for clinician_field
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
            fixed_tenant_id, 
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
                THEN ARRAY[user_meta->>'primary_state']
                ELSE NULL
            END,
            user_meta->>'clinician_license_type',
            user_meta->>'clinician_license_number',
            user_meta->>'clinician_taxonomy_code'
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
            true, true, true, true, true, COALESCE((user_meta->>'is_admin')::boolean, false)
        );
    END IF;
    
    RETURN NEW;
END;
$function$;