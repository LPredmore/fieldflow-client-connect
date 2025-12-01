-- Add new JSONB column to store detailed license information
-- Structure: [{ state: 'CA', licenseType: 'LMFT', licenseNumber: '12345', isPrimary: true }, ...]
ALTER TABLE public.clinicians 
ADD COLUMN clinician_licenses_detailed JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clinicians.clinician_licenses_detailed IS 
'Detailed license information including state, license type, and license number for each state. Format: [{"state": "CA", "licenseType": "LMFT", "licenseNumber": "12345", "isPrimary": true}]';