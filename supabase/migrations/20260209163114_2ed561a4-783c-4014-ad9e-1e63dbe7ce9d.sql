
-- 1. Add column
ALTER TABLE appointments ADD COLUMN documented_at timestamptz;

-- 2. Trigger function: set documented_at once on status -> 'documented'
CREATE OR REPLACE FUNCTION set_documented_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'documented'
     AND (OLD.status IS DISTINCT FROM 'documented')
     AND NEW.documented_at IS NULL THEN
    NEW.documented_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_documented_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION set_documented_at();

-- 3. Backfill: use session date (start_at) for existing documented appointments
UPDATE appointments
SET documented_at = start_at
WHERE status = 'documented' AND documented_at IS NULL;
