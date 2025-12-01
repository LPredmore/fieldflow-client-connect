-- Phase 1: Fix missing column in appointment_series
ALTER TABLE public.appointment_series 
ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT true;

-- Phase 2: Fix data consistency - update customers with completed profiles to registered status
UPDATE public.customers 
SET status = 'registered'
WHERE profile_completed = true 
  AND status = 'new';

-- Also ensure any customers with status 'registered' have profile_completed = true
UPDATE public.customers 
SET profile_completed = true 
WHERE status = 'registered' 
  AND profile_completed = false;