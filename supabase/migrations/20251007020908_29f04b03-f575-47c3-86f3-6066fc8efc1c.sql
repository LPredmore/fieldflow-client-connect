-- Clean up any remaining array clinician_field values
-- This migration converts legacy array values to text by taking the first element

UPDATE public.clinicians
SET clinician_field = (
  CASE 
    WHEN jsonb_typeof(to_jsonb(clinician_field)) = 'array' THEN
      (to_jsonb(clinician_field)->>0)
    ELSE
      clinician_field
  END
)
WHERE clinician_field IS NOT NULL;