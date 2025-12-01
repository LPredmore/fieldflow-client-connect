-- Add foreign key constraint from appointment_series.service_id to services.id
ALTER TABLE public.appointment_series 
ADD CONSTRAINT fk_appointment_series_service 
FOREIGN KEY (service_id) 
REFERENCES public.services(id) 
ON DELETE SET NULL;

-- Create index for better query performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_appointment_series_service_id 
ON public.appointment_series(service_id);