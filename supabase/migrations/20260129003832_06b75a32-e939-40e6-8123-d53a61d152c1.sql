-- Step 1: Create trigger function that auto-populates assessment_date from administered_at
CREATE OR REPLACE FUNCTION public.set_assessment_date_from_administered_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only set assessment_date if it's NULL
  IF NEW.assessment_date IS NULL THEN
    NEW.assessment_date := (NEW.administered_at AT TIME ZONE 'UTC')::date;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 2: Attach trigger to PHQ-9 table
CREATE TRIGGER set_phq9_assessment_date
BEFORE INSERT ON client_phq9_assessments
FOR EACH ROW
EXECUTE FUNCTION set_assessment_date_from_administered_at();

-- Step 3: Attach trigger to PCL-5 table
CREATE TRIGGER set_pcl5_assessment_date
BEFORE INSERT ON client_pcl5_assessments
FOR EACH ROW
EXECUTE FUNCTION set_assessment_date_from_administered_at();

-- Step 4: Fix existing NULL records (one-time data correction)
UPDATE client_phq9_assessments
SET assessment_date = (administered_at AT TIME ZONE 'UTC')::date
WHERE assessment_date IS NULL;

UPDATE client_pcl5_assessments
SET assessment_date = (administered_at AT TIME ZONE 'UTC')::date
WHERE assessment_date IS NULL;