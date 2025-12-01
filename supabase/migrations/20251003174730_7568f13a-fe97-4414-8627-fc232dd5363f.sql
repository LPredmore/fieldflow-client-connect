-- Drop the duplicate/legacy foreign key constraint on appointment_series.service_id
ALTER TABLE public.appointment_series 
DROP CONSTRAINT IF EXISTS job_series_service_id_fkey;