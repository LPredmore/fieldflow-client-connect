-- Phase 5: Update handle_client_signup to create user_roles entries
-- This ensures new signups work with the new role-based authentication system

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
    is_clinical_staff BOOLEAN;
    existing_customer_id UUID;
    generated_pass TEXT;
    new_role app_role;  -- NEW: Track role for user_roles table
BEGIN
    user_meta := NEW.raw_user_meta_data;
    
    computed_full_name := TRIM(CONCAT(
        COALESCE(user_meta->>'first_name', ''), 
        ' ', 
        COALESCE(user_meta->>'last_name', '')
    ));
    
    IF user_meta->>'user_type' = 'client' THEN
        actual_tenant_id := COALESCE(
            (user_meta->>'tenant_id')::UUID,
            fixed_tenant_id
        );
        
        -- NEW: Set role for client signup
        new_role := 'client'::app_role;
        
        INSERT INTO public.profiles (
            user_id, tenant_id, role, first_name, last_name, full_name, phone, email, company_name
        ) VALUES (
            NEW.id, actual_tenant_id, 'client',
            user_meta->>'first_name', user_meta->>'last_name', computed_full_name,
            user_meta->>'phone', NEW.email, user_meta->>'company_name'
        );
        
        -- Check if customer already exists (created by staff)
        SELECT id INTO existing_customer_id
        FROM public.customers
        WHERE email = NEW.email AND tenant_id = actual_tenant_id
        LIMIT 1;
        
        IF existing_customer_id IS NOT NULL THEN
            -- Update existing customer with client_user_id
            UPDATE public.customers
            SET client_user_id = NEW.id,
                updated_at = now()
            WHERE id = existing_customer_id;
            
            RAISE NOTICE 'Updated existing customer % with client_user_id', existing_customer_id;
        ELSE
            -- Create new customer record
            INSERT INTO public.customers (
                tenant_id, client_user_id, pat_name_f, pat_name_l, 
                preferred_name, email, pat_phone, status
            ) VALUES (
                actual_tenant_id, NEW.id, 
                user_meta->>'first_name', user_meta->>'last_name',
                user_meta->>'preferred_name', NEW.email, 
                user_meta->>'phone', 'new'
            );
            
            RAISE NOTICE 'Created new customer for user %', NEW.id;
        END IF;
        
    ELSIF user_meta->>'user_type' = 'contractor' THEN
        -- Extract inviter's tenant_id, company_name, avatar_url, and generated password
        actual_tenant_id := COALESCE(
            (user_meta->>'inviter_tenant_id')::UUID,
            fixed_tenant_id
        );
        company_name_value := user_meta->>'inviter_company_name';
        avatar_url_value := user_meta->>'inviter_avatar_url';
        generated_pass := user_meta->>'generated_password';
        
        -- Check if this is clinical staff (default to true for backward compatibility)
        is_clinical_staff := COALESCE((user_meta->>'is_clinician')::boolean, true);
        
        -- NEW: Determine role based on metadata
        new_role := CASE
            WHEN COALESCE((user_meta->>'is_admin')::boolean, false) THEN 'admin'::app_role
            WHEN is_clinical_staff THEN 'clinician'::app_role
            ELSE 'staff'::app_role
        END;
        
        -- Insert profile with generated password
        INSERT INTO public.profiles (
            user_id, tenant_id, role, first_name, last_name, full_name, phone, email, 
            company_name, avatar_url, password
        ) VALUES (
            NEW.id, actual_tenant_id, 'staff',
            user_meta->>'first_name', user_meta->>'last_name', computed_full_name,
            user_meta->>'phone', NEW.email, company_name_value, avatar_url_value,
            generated_pass
        );
        
        RAISE NOTICE 'Created profile for user % with password stored', NEW.id;
        
        -- Insert into clinicians table with conditional clinician_status
        INSERT INTO public.clinicians (
            user_id, 
            tenant_id, 
            clinician_status, 
            is_clinician, 
            is_admin,
            clinician_field,
            prov_npi,
            clinician_license_type,
            clinician_license_number,
            prov_taxonomy,
            prov_name_f,
            prov_name_last
        ) VALUES (
            NEW.id, 
            actual_tenant_id, 
            -- KEY LOGIC: Set status based on is_clinician
            CASE 
                WHEN is_clinical_staff = true THEN 'New'::clinician_status_enum
                ELSE 'Active'::clinician_status_enum
            END,
            is_clinical_staff,
            COALESCE((user_meta->>'is_admin')::boolean, false),
            -- Only populate clinical fields if is_clinician is true
            CASE WHEN is_clinical_staff THEN user_meta->>'clinician_field' ELSE NULL END,
            CASE WHEN is_clinical_staff THEN user_meta->>'clinician_npi_number' ELSE NULL END,
            CASE WHEN is_clinical_staff THEN user_meta->>'clinician_license_type' ELSE NULL END,
            CASE WHEN is_clinical_staff THEN user_meta->>'clinician_license_number' ELSE NULL END,
            CASE WHEN is_clinical_staff THEN user_meta->>'clinician_taxonomy_code' ELSE NULL END,
            user_meta->>'first_name',
            user_meta->>'last_name'
        );
        
        RAISE NOTICE 'Created clinician record for user %', NEW.id;
        
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
        
        RAISE NOTICE 'Created user_permissions for user %', NEW.id;
    END IF;
    
    -- CRITICAL: Create user_roles entry for all signups
    INSERT INTO public.user_roles (
        user_id, 
        role, 
        tenant_id, 
        granted_by_user_id
    )
    VALUES (
        NEW.id, 
        new_role, 
        actual_tenant_id, 
        NEW.id
    );
    
    RAISE NOTICE 'Created user_roles entry for user % with role %', NEW.id, new_role;
    
    RETURN NEW;
END;
$function$;