-- Drop the GIN index on clinician_field (only works with arrays)
DROP INDEX IF EXISTS idx_clinicians_field;

-- Change clinician_field from array to text
-- Migrate existing data (take first element of array if exists)
ALTER TABLE clinicians 
ALTER COLUMN clinician_field TYPE text 
USING CASE 
  WHEN clinician_field IS NOT NULL AND array_length(clinician_field, 1) > 0 
  THEN clinician_field[1]
  ELSE NULL
END;

-- Create a regular btree index for text searches (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_clinicians_field_text ON clinicians(clinician_field) 
WHERE clinician_field IS NOT NULL;