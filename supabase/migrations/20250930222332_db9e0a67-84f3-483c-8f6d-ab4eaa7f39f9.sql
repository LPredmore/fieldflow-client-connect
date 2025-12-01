-- Add appointment_id column to form_responses for linking session notes to appointments
ALTER TABLE public.form_responses 
ADD COLUMN appointment_id UUID REFERENCES public.appointment_occurrences(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_form_responses_appointment_id ON public.form_responses(appointment_id);