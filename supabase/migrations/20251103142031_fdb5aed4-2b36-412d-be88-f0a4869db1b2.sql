-- Add verification tracking columns to insurance_information
ALTER TABLE insurance_information
  ADD COLUMN verification_status text,
  ADD COLUMN verified_date timestamp with time zone,
  ADD COLUMN verification_notes text;

-- Add check constraint for verification_status values
ALTER TABLE insurance_information
  ADD CONSTRAINT verification_status_check 
  CHECK (verification_status IN ('verified', 'failed', 'pending') OR verification_status IS NULL);

-- Create index for faster queries on verification status
CREATE INDEX idx_insurance_verification 
  ON insurance_information(customer_id, verification_status, verified_date DESC)
  WHERE is_active = true;

-- Add helpful comments
COMMENT ON COLUMN insurance_information.verification_status IS 'Status of insurance eligibility verification: verified, failed, pending, or NULL if not yet checked';
COMMENT ON COLUMN insurance_information.verified_date IS 'Timestamp of last eligibility verification check';
COMMENT ON COLUMN insurance_information.verification_notes IS 'Notes from eligibility verification (success message or error details)';