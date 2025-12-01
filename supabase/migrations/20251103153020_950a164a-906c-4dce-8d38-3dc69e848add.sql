-- Add foreign key constraint for assigned_to_user_id
-- This allows Supabase PostgREST to understand the relationship
ALTER TABLE customers
ADD CONSTRAINT fk_customers_assigned_user
FOREIGN KEY (assigned_to_user_id) 
REFERENCES profiles(user_id)
ON DELETE SET NULL;

-- Add foreign key constraint for created_by_user_id
-- This ensures referential integrity for the creator
ALTER TABLE customers
ADD CONSTRAINT fk_customers_created_by_user
FOREIGN KEY (created_by_user_id) 
REFERENCES profiles(user_id)
ON DELETE SET NULL;

-- Add performance indexes
-- These speed up joins and lookups
CREATE INDEX IF NOT EXISTS idx_customers_assigned_user 
ON customers(assigned_to_user_id) 
WHERE assigned_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_created_by_user
ON customers(created_by_user_id)
WHERE created_by_user_id IS NOT NULL;

-- Add helpful comments
COMMENT ON CONSTRAINT fk_customers_assigned_user ON customers IS 
  'Links assigned_to_user_id to profiles.user_id for clinician assignment';
  
COMMENT ON CONSTRAINT fk_customers_created_by_user ON customers IS 
  'Links created_by_user_id to profiles.user_id for audit trail';