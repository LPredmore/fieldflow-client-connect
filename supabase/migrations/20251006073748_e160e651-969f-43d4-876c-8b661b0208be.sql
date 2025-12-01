-- Add cpt_code column to services table
ALTER TABLE public.services 
ADD COLUMN cpt_code TEXT;