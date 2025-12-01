-- Normalize sex fields to M/F format across all tables
-- Updates existing data from "Male"/"Female" to "M"/"F"
-- Adds check constraints to enforce valid values

-- Update customers table
UPDATE customers 
SET pat_sex = CASE 
  WHEN pat_sex = 'Male' THEN 'M'
  WHEN pat_sex = 'Female' THEN 'F'
  WHEN pat_sex IS NULL THEN NULL
  ELSE pat_sex  -- Preserve 'Other' or any other values
END
WHERE pat_sex IN ('Male', 'Female');

-- Update insurance_information table
UPDATE insurance_information 
SET insured_sex = CASE 
  WHEN insured_sex = 'Male' THEN 'M'
  WHEN insured_sex = 'Female' THEN 'F'
  WHEN insured_sex IS NULL THEN NULL
  ELSE insured_sex
END
WHERE insured_sex IN ('Male', 'Female');

-- Update appointment_occurrences table
UPDATE appointment_occurrences 
SET pat_sex = CASE 
  WHEN pat_sex = 'Male' THEN 'M'
  WHEN pat_sex = 'Female' THEN 'F'
  WHEN pat_sex IS NULL THEN NULL
  ELSE pat_sex
END
WHERE pat_sex IN ('Male', 'Female');

-- Add check constraints to enforce valid values
ALTER TABLE customers
ADD CONSTRAINT customers_pat_sex_check 
CHECK (pat_sex IS NULL OR pat_sex IN ('M', 'F', 'Other'));

ALTER TABLE insurance_information
ADD CONSTRAINT insurance_information_insured_sex_check 
CHECK (insured_sex IS NULL OR insured_sex IN ('M', 'F', 'Other'));

ALTER TABLE appointment_occurrences
ADD CONSTRAINT appointment_occurrences_pat_sex_check 
CHECK (pat_sex IS NULL OR pat_sex IN ('M', 'F', 'Other'));