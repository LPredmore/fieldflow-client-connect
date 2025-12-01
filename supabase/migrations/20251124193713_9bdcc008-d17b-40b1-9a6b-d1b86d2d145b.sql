-- ============================================
-- PHASE 1: Restore the Missing Trigger
-- ============================================
-- Ensure the trigger exists and is properly configured

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_client_signup();

-- ============================================
-- PHASE 2: Create Missing User Data
-- ============================================
-- Fix the two users who signed up without the trigger

-- Create missing profiles
INSERT INTO public.profiles (user_id, tenant_id, role, first_name, last_name, full_name, email)
VALUES 
  ('a61cc130-dfd6-4935-9dcc-46c7a3880ede'::uuid, 'c8b55588-d025-4275-8357-43a01ebe1a29'::uuid, 'staff', 'Adam', NULL, 'Adam', 'info+adam@valorwell.org'),
  ('7fca64c9-218f-4d13-8ae3-a499dd96d874'::uuid, 'c8b55588-d025-4275-8357-43a01ebe1a29'::uuid, 'staff', 'Test', 'Therapist', 'Test Therapist', 'info+test@valorwell.org')
ON CONFLICT (user_id) DO NOTHING;

-- Create missing user_roles (staff role)
INSERT INTO public.user_roles (user_id, role, tenant_id, granted_by_user_id, is_active)
VALUES 
  ('a61cc130-dfd6-4935-9dcc-46c7a3880ede'::uuid, 'staff'::app_role, 'c8b55588-d025-4275-8357-43a01ebe1a29'::uuid, 'a61cc130-dfd6-4935-9dcc-46c7a3880ede'::uuid, true),
  ('7fca64c9-218f-4d13-8ae3-a499dd96d874'::uuid, 'staff'::app_role, 'c8b55588-d025-4275-8357-43a01ebe1a29'::uuid, '7fca64c9-218f-4d13-8ae3-a499dd96d874'::uuid, true)
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

-- Create missing user_roles (clinician role)
INSERT INTO public.user_roles (user_id, role, tenant_id, granted_by_user_id, is_active)
VALUES 
  ('a61cc130-dfd6-4935-9dcc-46c7a3880ede'::uuid, 'clinician'::app_role, 'c8b55588-d025-4275-8357-43a01ebe1a29'::uuid, 'a61cc130-dfd6-4935-9dcc-46c7a3880ede'::uuid, true),
  ('7fca64c9-218f-4d13-8ae3-a499dd96d874'::uuid, 'clinician'::app_role, 'c8b55588-d025-4275-8357-43a01ebe1a29'::uuid, '7fca64c9-218f-4d13-8ae3-a499dd96d874'::uuid, true)
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

-- Create missing clinician records
INSERT INTO public.clinicians (user_id, tenant_id, is_clinician, is_admin, clinician_status, clinician_license_type, prov_npi, prov_name_f, prov_name_last)
VALUES 
  ('a61cc130-dfd6-4935-9dcc-46c7a3880ede'::uuid, 'c8b55588-d025-4275-8357-43a01ebe1a29'::uuid, true, false, 'New'::clinician_status_enum, 'Psychologist', '1154781623', 'Adam', NULL),
  ('7fca64c9-218f-4d13-8ae3-a499dd96d874'::uuid, 'c8b55588-d025-4275-8357-43a01ebe1a29'::uuid, true, false, 'New'::clinician_status_enum, 'LPC', '12345', 'Test', 'Therapist')
ON CONFLICT (user_id) DO NOTHING;

-- Create missing user_permissions
INSERT INTO public.user_permissions (user_id, tenant_id, access_appointments, access_services, access_invoicing, access_forms, access_calendar, supervisor)
VALUES 
  ('a61cc130-dfd6-4935-9dcc-46c7a3880ede'::uuid, 'c8b55588-d025-4275-8357-43a01ebe1a29'::uuid, true, true, true, true, true, false),
  ('7fca64c9-218f-4d13-8ae3-a499dd96d874'::uuid, 'c8b55588-d025-4275-8357-43a01ebe1a29'::uuid, true, true, true, true, true, false)
ON CONFLICT (user_id, tenant_id) DO NOTHING;