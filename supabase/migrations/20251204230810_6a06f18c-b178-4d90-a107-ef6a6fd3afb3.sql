-- Seed default "Therapy Session" service for existing tenants
-- This ensures the calendar system has at least one session type available

-- Insert default service for each tenant that doesn't have one yet
-- We need a profile_id, so we'll use the first admin profile for each tenant
INSERT INTO services (tenant_id, name, description, duration_minutes, price_per_unit, category, is_active, schedulable, created_by_profile_id)
SELECT 
  t.id as tenant_id,
  'Therapy Session' as name,
  'Standard therapy session' as description,
  60 as duration_minutes,
  150 as price_per_unit,
  'therapy' as category,
  true as is_active,
  true as schedulable,
  (SELECT profile_id FROM tenant_memberships WHERE tenant_id = t.id LIMIT 1) as created_by_profile_id
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM services s 
  WHERE s.tenant_id = t.id AND s.name = 'Therapy Session'
)
AND EXISTS (
  SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = t.id
);

-- Add unique constraint on series_id + start_at for appointments table
-- This enables the upsert in the edge function to avoid duplicates
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'appointments_series_id_start_at_key'
  ) THEN
    ALTER TABLE appointments 
    ADD CONSTRAINT appointments_series_id_start_at_key 
    UNIQUE (series_id, start_at);
  END IF;
END $$;