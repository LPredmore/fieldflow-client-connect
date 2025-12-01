-- Phase 2: Data Migration - Migrate existing roles to user_roles table
-- This migration atomically transfers role data from profiles/clinicians to user_roles

-- Step 1: Migrate basic roles from profiles table
-- Map profiles.role to user_roles entries
INSERT INTO public.user_roles (user_id, role, tenant_id, granted_by_user_id, granted_at, is_active)
SELECT 
  p.user_id,
  p.role::text::public.app_role, -- Cast from old user_role enum to new app_role enum
  p.tenant_id,
  NULL, -- No granting user for migrated data
  p.created_at,
  NOT p.archived -- Only active if not archived
FROM public.profiles p
WHERE p.role IS NOT NULL
  AND NOT EXISTS (
    -- Avoid duplicates if migration runs multiple times
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.user_id 
      AND ur.role = p.role::text::public.app_role
      AND ur.tenant_id = p.tenant_id
  )
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

-- Step 2: Migrate clinician role from clinicians table
-- Add 'clinician' role for users who have is_clinician = true
INSERT INTO public.user_roles (user_id, role, tenant_id, granted_by_user_id, granted_at, is_active)
SELECT 
  c.user_id,
  'clinician'::public.app_role,
  c.tenant_id,
  NULL,
  c.created_at,
  true
FROM public.clinicians c
WHERE c.is_clinician = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = c.user_id 
      AND ur.role = 'clinician'
      AND ur.tenant_id = c.tenant_id
  )
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

-- Step 3: Migrate admin role from clinicians table
-- Add 'admin' role for users who have is_admin = true
INSERT INTO public.user_roles (user_id, role, tenant_id, granted_by_user_id, granted_at, is_active)
SELECT 
  c.user_id,
  'admin'::public.app_role,
  c.tenant_id,
  NULL,
  c.created_at,
  true
FROM public.clinicians c
WHERE c.is_admin = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = c.user_id 
      AND ur.role = 'admin'
      AND ur.tenant_id = c.tenant_id
  )
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

-- Step 4: Handle edge case - users in clinicians but not in profiles
-- These are users who have clinician records but might not have basic staff role
INSERT INTO public.user_roles (user_id, role, tenant_id, granted_by_user_id, granted_at, is_active)
SELECT 
  c.user_id,
  'staff'::public.app_role,
  c.tenant_id,
  NULL,
  c.created_at,
  true
FROM public.clinicians c
WHERE NOT EXISTS (
    -- Check if they already have a staff or client role
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = c.user_id 
      AND ur.role IN ('staff', 'client')
      AND ur.tenant_id = c.tenant_id
  )
  AND NOT EXISTS (
    -- Also check profiles to avoid conflicts
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = c.user_id
      AND p.role = 'client'
  )
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

-- Step 5: Verification - Create a view to compare old vs new role data
CREATE OR REPLACE VIEW public.role_migration_verification AS
SELECT 
  p.user_id,
  p.full_name,
  p.email,
  p.tenant_id,
  p.role AS old_profile_role,
  c.is_clinician AS old_is_clinician,
  c.is_admin AS old_is_admin,
  c.clinician_status,
  ARRAY_AGG(DISTINCT ur.role::text ORDER BY ur.role::text) AS new_roles,
  COUNT(DISTINCT ur.role) AS role_count,
  BOOL_OR(ur.is_active) AS has_active_role
FROM public.profiles p
LEFT JOIN public.clinicians c ON c.user_id = p.user_id
LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.tenant_id = p.tenant_id
GROUP BY p.user_id, p.full_name, p.email, p.tenant_id, p.role, c.is_clinician, c.is_admin, c.clinician_status
ORDER BY p.full_name;

-- Add helpful comments
COMMENT ON VIEW public.role_migration_verification IS 'Verification view to compare old role system (profiles.role, clinicians.is_admin) with new user_roles table. Use this to verify Phase 2 migration completeness.';

-- Step 6: Create function to audit migration results
CREATE OR REPLACE FUNCTION public.verify_role_migration()
RETURNS TABLE (
  verification_status TEXT,
  total_users BIGINT,
  users_with_roles BIGINT,
  users_without_roles BIGINT,
  orphaned_roles BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    'Migration Verification' AS verification_status,
    (SELECT COUNT(DISTINCT user_id) FROM profiles) AS total_users,
    (SELECT COUNT(DISTINCT user_id) FROM user_roles WHERE is_active = true) AS users_with_roles,
    (SELECT COUNT(DISTINCT p.user_id) 
     FROM profiles p 
     WHERE NOT EXISTS (
       SELECT 1 FROM user_roles ur 
       WHERE ur.user_id = p.user_id AND ur.is_active = true
     )) AS users_without_roles,
    (SELECT COUNT(*) 
     FROM user_roles ur 
     WHERE NOT EXISTS (
       SELECT 1 FROM profiles p WHERE p.user_id = ur.user_id
     )) AS orphaned_roles;
$$;

COMMENT ON FUNCTION public.verify_role_migration IS 'Run this function to verify Phase 2 migration results: SELECT * FROM verify_role_migration();';