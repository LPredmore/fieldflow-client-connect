-- Single-tenant migration: Use a fixed tenant ID for all users
-- This makes the application single-tenant where one clinic owns everything

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the old function
DROP FUNCTION IF EXISTS public.handle_client_signup();

-- Create the new single-tenant signup handler
CREATE OR REPLACE FUNCTION public.handle_client_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    user_meta JSONB;
    fixed_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID; -- Fixed tenant ID for single-tenant
    computed_full_name TEXT;
BEGIN
    user_meta := NEW.raw_user_meta_data;
    
    -- Compute full_name from first_name and last_name for backward compatibility
    computed_full_name := TRIM(CONCAT(
        COALESCE(user_meta->>'first_name', ''), 
        ' ', 
        COALESCE(user_meta->>'last_name', '')
    ));
    
    -- Process client signup
    IF user_meta->>'user_type' = 'client' THEN
        -- Insert into profiles with the FIXED tenant_id
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
            fixed_tenant_id, -- Use fixed tenant ID
            'client',
            user_meta->>'first_name',
            user_meta->>'last_name',
            computed_full_name,
            user_meta->>'phone',
            NEW.email,
            user_meta->>'company_name'
        );
        
        -- Insert into customers with the same fixed tenant_id
        INSERT INTO public.customers (
            tenant_id,
            client_user_id,
            name,
            customer_type,
            phone,
            email,
            profile_completed,
            status
        ) VALUES (
            fixed_tenant_id, -- Use fixed tenant ID
            NEW.id,
            computed_full_name,
            'residential',
            user_meta->>'phone',
            NEW.email,
            false,
            'new'
        );
        
    ELSIF user_meta->>'user_type' = 'contractor' THEN
        -- Insert into profiles for contractor with the FIXED tenant_id
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
            fixed_tenant_id, -- Use fixed tenant ID
            'business_admin',
            user_meta->>'first_name',
            user_meta->>'last_name',
            computed_full_name,
            user_meta->>'phone',
            NEW.email,
            user_meta->>'company_name'
        );
        
        -- Create or update settings for the business (only if it doesn't exist)
        INSERT INTO public.settings (
            tenant_id,
            created_by_user_id,
            business_name,
            business_email
        ) VALUES (
            fixed_tenant_id, -- Use fixed tenant ID
            NEW.id,
            user_meta->>'company_name',
            NEW.email
        )
        ON CONFLICT (tenant_id) DO NOTHING; -- Don't overwrite if settings already exist
        
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
            fixed_tenant_id, -- Use fixed tenant ID
            NEW.id,
            true, true, true, true, true, true, true, true
        );
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_client_signup();

-- Add unique constraint on tenant_id for settings table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'settings_tenant_id_key'
    ) THEN
        ALTER TABLE public.settings ADD CONSTRAINT settings_tenant_id_key UNIQUE (tenant_id);
    END IF;
END $$;