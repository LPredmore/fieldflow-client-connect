-- Drop quote-related tables and types
-- First drop dependent objects

-- Drop quotes table (this will cascade to related objects)
DROP TABLE IF EXISTS public.quotes CASCADE;

-- Drop quote_responses table if it exists
DROP TABLE IF EXISTS public.quote_responses CASCADE;

-- Drop quote_status enum type
DROP TYPE IF EXISTS public.quote_status CASCADE;

-- Remove quote-related columns from user_permissions table
ALTER TABLE public.user_permissions 
DROP COLUMN IF EXISTS access_quotes,
DROP COLUMN IF EXISTS send_quotes;

-- Drop any quote-related functions
DROP FUNCTION IF EXISTS public.generate_quote_share_token() CASCADE;
DROP FUNCTION IF EXISTS public.get_public_quote_by_token(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.validate_quote_response_input(uuid, text, text, text) CASCADE;

-- Clean up any quote references in invoices table (if job_id references quotes)
-- The invoices table has a job_id column but not quote_id, so no cleanup needed there