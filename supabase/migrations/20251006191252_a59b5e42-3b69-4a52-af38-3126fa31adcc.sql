-- Update customers.state column from text to us_states enum
-- This will fail if any existing records have invalid state values
ALTER TABLE public.customers 
ALTER COLUMN state TYPE us_states 
USING CASE 
  WHEN state IS NULL THEN NULL
  ELSE state::us_states 
END;