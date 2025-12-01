
-- Clean up ghost auth users and update clinician provider names

-- Update all clinician records with provider names from profiles
UPDATE clinicians c
SET 
  prov_name_f = p.first_name,
  prov_name_last = p.last_name,
  updated_at = now()
FROM profiles p
WHERE c.user_id = p.user_id
  AND p.first_name IS NOT NULL
  AND p.last_name IS NOT NULL
  AND (c.prov_name_f IS NULL OR c.prov_name_last IS NULL OR c.prov_name_f = '' OR c.prov_name_last = '');

-- Create index for better query performance on archived users
CREATE INDEX IF NOT EXISTS idx_profiles_active_staff ON profiles(tenant_id, role, archived) 
WHERE role = 'staff' AND archived = false;

-- Add helpful comment
COMMENT ON COLUMN clinicians.prov_name_f IS 'Provider first name - used for CMS-1500 claims. Should match profile first_name';
COMMENT ON COLUMN clinicians.prov_name_last IS 'Provider last name - used for CMS-1500 claims. Should match profile last_name';
