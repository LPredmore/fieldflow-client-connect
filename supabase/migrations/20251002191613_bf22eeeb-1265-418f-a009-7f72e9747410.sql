-- Remove duplicate foreign key constraint on appointment_occurrences
-- This fixes the PostgREST error: "more than one relationship was found for 'appointment_occurrences' and 'appointment_series'"

-- Drop the old foreign key constraint with legacy naming from when the table was called job_occurrences
ALTER TABLE public.appointment_occurrences
DROP CONSTRAINT IF EXISTS job_occurrences_series_id_fkey;

-- The properly named constraint appointment_occurrences_series_id_fkey is kept
-- It correctly references appointment_series(id) via series_id column