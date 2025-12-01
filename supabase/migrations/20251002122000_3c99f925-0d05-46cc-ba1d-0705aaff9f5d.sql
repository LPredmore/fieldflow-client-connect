-- Add missing foreign key constraint from appointment_occurrences to appointment_series
-- This will allow PostgREST to properly resolve the relationship and fix the schema cache error

ALTER TABLE public.appointment_occurrences
ADD CONSTRAINT appointment_occurrences_series_id_fkey 
FOREIGN KEY (series_id) 
REFERENCES public.appointment_series(id) 
ON DELETE CASCADE;