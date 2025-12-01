-- Migration: Add clinician status initialization logic
-- This migration enhances the existing handle_client_signup function to properly
-- initialize clinician_status based on the is_clinician flag

-- Create a function to initialize clinician status based on staff type
CREATE OR REPLACE FUNCTION public.initialize_clinician_status(
    p_user_id UUID,
    p_tenant_id UUID,
    p_is_clinician BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Set appropriate status based on clinician designation
    -- New clinicians get "New" status, non-clinician staff get "Active" status
    UPDATE public.clinicians 
    SET clinician_status = CASE 
        WHEN p_is_clinician THEN 'New'::clinician_status_enum
        ELSE 'Active'::clinician_status_enum
    END,
    updated_at = now()
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
    
    -- Log the initialization for audit purposes
    RAISE NOTICE 'Initialized clinician status for user % (is_clinician: %, status: %)', 
        p_user_id, 
        p_is_clinician, 
        CASE WHEN p_is_clinician THEN 'New' ELSE 'Active' END;
END;
$function$;

-- Update the handle_client_signup function to use proper status initialization
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
    initial_status clinician_status_enum;
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
        -- Extract inviter's tenant_id, company_name, and avatar_url
        actual_tenant_id := COALESCE(
            (user_meta->>'inviter_tenant_id')::UUID,
            fixed_tenant_id
        );
        company_name_value := user_meta->>'inviter_company_name';
        avatar_url_value := user_meta->>'inviter_avatar_url';
        
        -- Check if this is clinical staff (default to true for backward compatibility)
        is_clinical_staff := COALESCE((user_meta->>'is_clinician')::boolean, true);
        
        -- Determine initial clinician status based on staff type
        -- New clinicians get "New" status, non-clinician staff get "Active" status
        initial_status := CASE 
            WHEN is_clinical_staff THEN 'New'::clinician_status_enum
            ELSE 'Active'::clinician_status_enum
        END;
        
        INSERT INTO public.profiles (
            user_id, tenant_id, role, first_name, last_name, full_name, phone, email, company_name, avatar_url
        ) VALUES (
            NEW.id, actual_tenant_id, 'staff',
            user_meta->>'first_name', user_meta->>'last_name', computed_full_name,
            user_meta->>'phone', NEW.email, company_name_value, avatar_url_value
        );
        
        -- Insert into clinicians table with proper status initialization
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
            initial_status,  -- Use computed initial status
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
        
        -- Log the successful staff initialization
        RAISE NOTICE 'Initialized staff member % with clinician status: % (is_clinician: %)', 
            NEW.id, initial_status, is_clinical_staff;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create a function to fix existing staff members who may not have proper status
CREATE OR REPLACE FUNCTION public.fix_existing_staff_clinician_status()
RETURNS TABLE(user_id UUID, old_status TEXT, new_status TEXT, is_clinician BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    staff_record RECORD;
    old_status_text TEXT;
    new_status_text TEXT;
BEGIN
    -- Find all staff members in clinicians table
    FOR staff_record IN 
        SELECT c.user_id, c.clinician_status, c.is_clinician, c.tenant_id
        FROM public.clinicians c
        INNER JOIN public.profiles p ON c.user_id = p.user_id
        WHERE p.role = 'staff'
    LOOP
        old_status_text := staff_record.clinician_status::TEXT;
        
        -- Determine what the status should be based on is_clinician flag
        IF staff_record.is_clinician = true AND staff_record.clinician_status IS NULL THEN
            -- Clinician without status - set to New
            UPDATE public.clinicians 
            SET clinician_status = 'New'::clinician_status_enum,
                updated_at = now()
            WHERE user_id = staff_record.user_id;
            new_status_text := 'New';
            
        ELSIF staff_record.is_clinician = false AND staff_record.clinician_status IS NULL THEN
            -- Non-clinician staff without status - set to Active
            UPDATE public.clinicians 
            SET clinician_status = 'Active'::clinician_status_enum,
                updated_at = now()
            WHERE user_id = staff_record.user_id;
            new_status_text := 'Active';
            
        ELSE
            -- Status is already set appropriately
            new_status_text := old_status_text;
        END IF;
        
        -- Return the result for this user
        user_id := staff_record.user_id;
        old_status := old_status_text;
        new_status := new_status_text;
        is_clinician := staff_record.is_clinician;
        
        RETURN NEXT;
    END LOOP;
END;
$function$;

-- Add a comment explaining the status initialization logic
COMMENT ON FUNCTION public.initialize_clinician_status(UUID, UUID, BOOLEAN) IS 
'Initializes clinician_status based on staff type: "New" for clinicians, "Active" for non-clinician staff';

COMMENT ON FUNCTION public.fix_existing_staff_clinician_status() IS 
'Fixes existing staff members who may not have proper clinician_status values';