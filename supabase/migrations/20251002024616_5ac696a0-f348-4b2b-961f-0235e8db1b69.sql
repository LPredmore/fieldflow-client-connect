-- Remove the redundant profile_completed column from customers table
-- The status enum already provides all necessary states ('new', 'completing_signup', 'registered')

ALTER TABLE customers DROP COLUMN IF EXISTS profile_completed;

-- Add a comment to document that status is the single source of truth
COMMENT ON COLUMN customers.status IS 'Single source of truth for client registration state: new, completing_signup, or registered';