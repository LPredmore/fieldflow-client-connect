-- Add new fields to customers table for enhanced client profiles
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS preferred_name text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS gender_identity text,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS street_address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zip_code text;

-- Add comment explaining the fields
COMMENT ON COLUMN public.customers.preferred_name IS 'The name the client prefers to be called';
COMMENT ON COLUMN public.customers.date_of_birth IS 'Client date of birth for age calculation';
COMMENT ON COLUMN public.customers.gender IS 'Client gender';
COMMENT ON COLUMN public.customers.gender_identity IS 'Client gender identity';
COMMENT ON COLUMN public.customers.timezone IS 'Client preferred timezone';
COMMENT ON COLUMN public.customers.street_address IS 'Street address (separate from address JSONB for easier access)';
COMMENT ON COLUMN public.customers.city IS 'City';
COMMENT ON COLUMN public.customers.state IS 'State/Province';
COMMENT ON COLUMN public.customers.zip_code IS 'ZIP/Postal code';