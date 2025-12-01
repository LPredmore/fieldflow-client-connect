-- Add verification fields to clinician_licenses table
ALTER TABLE clinician_licenses
ADD COLUMN verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
ADD COLUMN verified_by_user_id UUID REFERENCES profiles(user_id),
ADD COLUMN verified_at TIMESTAMPTZ,
ADD COLUMN verification_notes TEXT;

-- Add index for verification status filtering
CREATE INDEX idx_clinician_licenses_verification_status ON clinician_licenses(verification_status);

-- Add comment for documentation
COMMENT ON COLUMN clinician_licenses.verification_status IS 'License verification status: unverified (default), pending (under review), verified (confirmed valid), rejected (found invalid)';
COMMENT ON COLUMN clinician_licenses.verified_by_user_id IS 'User ID of the admin who verified the license';
COMMENT ON COLUMN clinician_licenses.verified_at IS 'Timestamp when the license was verified';
COMMENT ON COLUMN clinician_licenses.verification_notes IS 'Admin notes about the verification process';