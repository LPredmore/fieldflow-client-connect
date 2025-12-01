-- Add first_name and last_name columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN first_name text,
ADD COLUMN last_name text;

-- Create or replace the handle_client_signup function to use first_name and last_name
CREATE OR REPLACE FUNCTION public.handle_client_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    user_meta JSONB;
    new_tenant_id UUID;
    computed_full_name TEXT;
BEGIN
    user_meta := NEW.raw_user_meta_data;
    
    -- Compute full_name from first_name and last_name for backward compatibility
    computed_full_name := TRIM(CONCAT(
        COALESCE(user_meta->>'first_name', ''), 
        ' ', 
        COALESCE(user_meta->>'last_name', '')
    ));
    
    -- Only process if this is a client signup
    IF user_meta->>'user_type' = 'client' THEN
        -- Generate a new tenant ID for the client (they are their own tenant)
        new_tenant_id := gen_random_uuid();
        
        -- Insert into profiles
        INSERT INTO public.profiles (
            user_id, 
            tenant_id, 
            role, 
            first_name,
            last_name,
            full_name, 
            phone, 
            email,
            company_name
        ) VALUES (
            NEW.id,
            new_tenant_id,
            'client',
            user_meta->>'first_name',
            user_meta->>'last_name',
            computed_full_name,
            user_meta->>'phone',
            NEW.email,
            user_meta->>'company_name'
        );
        
        -- Insert into customers (client becomes their own customer record)
        INSERT INTO public.customers (
            tenant_id,
            client_user_id,
            name,
            customer_type,
            phone,
            email
        ) VALUES (
            new_tenant_id,
            NEW.id,
            computed_full_name,
            'residential', -- default for client signups
            user_meta->>'phone',
            NEW.email
        );
        
    ELSIF user_meta->>'user_type' = 'contractor' THEN
        -- Generate a new tenant ID for contractors (they create their own business)
        new_tenant_id := gen_random_uuid();
        
        -- Insert into profiles for contractor
        INSERT INTO public.profiles (
            user_id, 
            tenant_id, 
            role, 
            first_name,
            last_name,
            full_name, 
            phone, 
            email,
            company_name
        ) VALUES (
            NEW.id,
            new_tenant_id,
            'business_admin', -- contractors start as business admins
            user_meta->>'first_name',
            user_meta->>'last_name',
            computed_full_name,
            user_meta->>'phone',
            NEW.email,
            user_meta->>'company_name'
        );
        
        -- Create initial settings for the business
        INSERT INTO public.settings (
            tenant_id,
            created_by_user_id,
            business_name,
            business_email
        ) VALUES (
            new_tenant_id,
            NEW.id,
            user_meta->>'company_name',
            NEW.email
        );
        
        -- Create initial permissions for the business admin
        INSERT INTO public.user_permissions (
            tenant_id,
            user_id,
            access_jobs,
            access_customers,
            access_services,
            access_quotes,
            access_invoicing,
            access_calendar,
            access_settings,
            access_user_management
        ) VALUES (
            new_tenant_id,
            NEW.id,
            true, true, true, true, true, true, true, true
        );
    END IF;
    
    RETURN NEW;
END;
$function$