-- Phase 2: Data Synchronization Between user_roles and clinicians Tables
-- This migration creates a bidirectional sync during the migration period

-- ============================================================================
-- STEP 1: Create Trigger Function to Sync clinicians → user_roles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_clinician_roles_to_user_roles()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_granting_user_id UUID;
BEGIN
  -- Get tenant_id and user performing action
  v_tenant_id := NEW.tenant_id;
  v_granting_user_id := COALESCE(auth.uid(), NEW.user_id);
  
  RAISE NOTICE '[Sync Trigger] Processing % operation for user %', TG_OP, NEW.user_id;
  
  -- ============================================
  -- Sync is_admin changes
  -- ============================================
  IF (TG_OP = 'UPDATE' AND OLD.is_admin IS DISTINCT FROM NEW.is_admin) OR 
     (TG_OP = 'INSERT' AND NEW.is_admin = true) THEN
    
    IF NEW.is_admin = true THEN
      -- Grant admin role
      INSERT INTO public.user_roles (user_id, role, tenant_id, granted_by_user_id, is_active)
      VALUES (NEW.user_id, 'admin'::app_role, v_tenant_id, v_granting_user_id, true)
      ON CONFLICT (user_id, role, tenant_id) 
      DO UPDATE SET 
        is_active = true,
        updated_at = now();
        
      RAISE NOTICE '[Sync Trigger] ✓ Granted admin role to user %', NEW.user_id;
    ELSE
      -- Revoke admin role
      UPDATE public.user_roles 
      SET is_active = false, updated_at = now()
      WHERE user_id = NEW.user_id 
        AND role = 'admin'::app_role
        AND tenant_id = v_tenant_id
        AND is_active = true;
        
      RAISE NOTICE '[Sync Trigger] ✗ Revoked admin role from user %', NEW.user_id;
    END IF;
  END IF;
  
  -- ============================================
  -- Sync is_clinician changes
  -- ============================================
  IF (TG_OP = 'UPDATE' AND OLD.is_clinician IS DISTINCT FROM NEW.is_clinician) OR
     (TG_OP = 'INSERT' AND NEW.is_clinician = true) THEN
    
    IF NEW.is_clinician = true THEN
      -- Grant clinician role
      INSERT INTO public.user_roles (user_id, role, tenant_id, granted_by_user_id, is_active)
      VALUES (NEW.user_id, 'clinician'::app_role, v_tenant_id, v_granting_user_id, true)
      ON CONFLICT (user_id, role, tenant_id) 
      DO UPDATE SET 
        is_active = true,
        updated_at = now();
        
      RAISE NOTICE '[Sync Trigger] ✓ Granted clinician role to user %', NEW.user_id;
    ELSE
      -- Revoke clinician role
      UPDATE public.user_roles 
      SET is_active = false, updated_at = now()
      WHERE user_id = NEW.user_id 
        AND role = 'clinician'::app_role
        AND tenant_id = v_tenant_id
        AND is_active = true;
        
      RAISE NOTICE '[Sync Trigger] ✗ Revoked clinician role from user %', NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_clinician_roles_to_user_roles() IS 
  'Automatically syncs is_admin and is_clinician flags from clinicians table to user_roles table. Part of Phase 2 migration strategy.';

-- ============================================================================
-- STEP 2: Create Trigger on clinicians Table
-- ============================================================================

DROP TRIGGER IF EXISTS sync_clinician_to_user_roles ON public.clinicians;

CREATE TRIGGER sync_clinician_to_user_roles
AFTER INSERT OR UPDATE OF is_admin, is_clinician ON public.clinicians
FOR EACH ROW
EXECUTE FUNCTION public.sync_clinician_roles_to_user_roles();

COMMENT ON TRIGGER sync_clinician_to_user_roles ON public.clinicians IS 
  'Triggers sync to user_roles whenever is_admin or is_clinician changes in clinicians table';

-- ============================================================================
-- STEP 3: Backfill Existing Data
-- ============================================================================

DO $$
DECLARE
  synced_admins INT := 0;
  synced_clinicians INT := 0;
  synced_staff INT := 0;
  total_clinician_records INT;
  admin_count INT;
  clinician_count INT;
BEGIN
  SELECT COUNT(*) INTO total_clinician_records FROM public.clinicians;
  SELECT COUNT(*) INTO admin_count FROM public.clinicians WHERE is_admin = true;
  SELECT COUNT(*) INTO clinician_count FROM public.clinicians WHERE is_clinician = true;
  
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Starting backfill migration';
  RAISE NOTICE 'Total clinician records: %', total_clinician_records;
  RAISE NOTICE 'Records with is_admin=true: %', admin_count;
  RAISE NOTICE 'Records with is_clinician=true: %', clinician_count;
  RAISE NOTICE '====================================================';
  
  -- Sync all staff roles
  INSERT INTO public.user_roles (user_id, role, tenant_id, granted_by_user_id, is_active)
  SELECT 
    c.user_id, 
    'staff'::app_role, 
    c.tenant_id, 
    c.user_id,
    true
  FROM public.clinicians c
  ON CONFLICT (user_id, role, tenant_id) 
  DO UPDATE SET is_active = true, updated_at = now();
  
  GET DIAGNOSTICS synced_staff = ROW_COUNT;
  RAISE NOTICE '✓ Synced % staff roles', synced_staff;
  
  -- Sync admin roles
  INSERT INTO public.user_roles (user_id, role, tenant_id, granted_by_user_id, is_active)
  SELECT 
    c.user_id, 
    'admin'::app_role, 
    c.tenant_id, 
    c.user_id,
    true
  FROM public.clinicians c
  WHERE c.is_admin = true
  ON CONFLICT (user_id, role, tenant_id) 
  DO UPDATE SET is_active = true, updated_at = now();
  
  GET DIAGNOSTICS synced_admins = ROW_COUNT;
  RAISE NOTICE '✓ Synced % admin roles', synced_admins;
  
  -- Sync clinician roles
  INSERT INTO public.user_roles (user_id, role, tenant_id, granted_by_user_id, is_active)
  SELECT 
    c.user_id, 
    'clinician'::app_role, 
    c.tenant_id, 
    c.user_id,
    true
  FROM public.clinicians c
  WHERE c.is_clinician = true
  ON CONFLICT (user_id, role, tenant_id) 
  DO UPDATE SET is_active = true, updated_at = now();
  
  GET DIAGNOSTICS synced_clinicians = ROW_COUNT;
  RAISE NOTICE '✓ Synced % clinician roles', synced_clinicians;
  
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Backfill complete! Staff: %, Admin: %, Clinician: %', 
    synced_staff, synced_admins, synced_clinicians;
  RAISE NOTICE '====================================================';
END $$;

-- ============================================================================
-- STEP 4: Create Verification View
-- ============================================================================

DROP VIEW IF EXISTS public.role_sync_verification;

CREATE OR REPLACE VIEW public.role_sync_verification AS
SELECT 
  c.user_id,
  p.email,
  p.full_name,
  c.is_admin as clinicians_is_admin,
  c.is_clinician as clinicians_is_clinician,
  EXISTS(
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = c.user_id 
      AND ur.role = 'admin'::app_role 
      AND ur.is_active = true
  ) as has_admin_role,
  EXISTS(
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = c.user_id 
      AND ur.role = 'clinician'::app_role 
      AND ur.is_active = true
  ) as has_clinician_role,
  EXISTS(
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = c.user_id 
      AND ur.role = 'staff'::app_role 
      AND ur.is_active = true
  ) as has_staff_role,
  CASE 
    WHEN c.is_admin != EXISTS(
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = c.user_id 
        AND ur.role = 'admin'::app_role 
        AND ur.is_active = true
    ) THEN 'ADMIN_MISMATCH'
    WHEN c.is_clinician != EXISTS(
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = c.user_id 
        AND ur.role = 'clinician'::app_role 
        AND ur.is_active = true
    ) THEN 'CLINICIAN_MISMATCH'
    ELSE 'IN_SYNC'
  END as sync_status
FROM clinicians c
LEFT JOIN profiles p ON p.user_id = c.user_id
ORDER BY sync_status DESC, p.email;

COMMENT ON VIEW public.role_sync_verification IS 
  'Shows sync status between clinicians flags and user_roles table';

GRANT SELECT ON public.role_sync_verification TO authenticated;

-- ============================================================================
-- STEP 5: Run Verification
-- ============================================================================

DO $$
DECLARE
  mismatch_count INT;
  in_sync_count INT;
BEGIN
  SELECT COUNT(*) INTO mismatch_count 
  FROM public.role_sync_verification 
  WHERE sync_status != 'IN_SYNC';
  
  SELECT COUNT(*) INTO in_sync_count 
  FROM public.role_sync_verification 
  WHERE sync_status = 'IN_SYNC';
  
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Verification: In sync: %, Mismatches: %', in_sync_count, mismatch_count;
  
  IF mismatch_count > 0 THEN
    RAISE WARNING 'Found % mismatches. Query: SELECT * FROM role_sync_verification WHERE sync_status != ''IN_SYNC'';', mismatch_count;
  ELSE
    RAISE NOTICE '✓ All records in sync!';
  END IF;
  RAISE NOTICE '====================================================';
END $$;