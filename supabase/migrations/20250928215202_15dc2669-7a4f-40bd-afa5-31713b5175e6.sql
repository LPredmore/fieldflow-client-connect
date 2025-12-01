-- Add missing columns that the existing code expects
ALTER TABLE public.job_occurrences 
ADD COLUMN actual_cost DECIMAL(10,2),
ADD COLUMN override_estimated_cost DECIMAL(10,2);

ALTER TABLE public.job_series
ADD COLUMN start_date DATE,
ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.user_permissions
ADD COLUMN send_quotes BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN supervisor BOOLEAN NOT NULL DEFAULT false;