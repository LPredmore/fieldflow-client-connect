-- Phase 1: Add required columns to appointment_series for rolling horizon
ALTER TABLE appointment_series 
ADD COLUMN IF NOT EXISTS local_start_time TIME NOT NULL DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS until_date DATE,
ADD COLUMN IF NOT EXISTS last_generated_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';

-- Add performance indexes for horizon extension queries
CREATE INDEX IF NOT EXISTS idx_appointment_series_active_horizon 
ON appointment_series(active, last_generated_until) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_appointment_series_generation_status 
ON appointment_series(generation_status, last_generated_until) 
WHERE active = true;

-- Add helpful comments
COMMENT ON COLUMN appointment_series.local_start_time IS 'Local time for recurring appointments (time portion only)';
COMMENT ON COLUMN appointment_series.timezone IS 'IANA timezone for this appointment series';
COMMENT ON COLUMN appointment_series.until_date IS 'Optional end date for recurring series';
COMMENT ON COLUMN appointment_series.last_generated_until IS 'Last date/time we generated occurrences up to';
COMMENT ON COLUMN appointment_series.generation_status IS 'Status of occurrence generation: pending, generating, completed, failed';
COMMENT ON COLUMN appointment_series.duration_minutes IS 'Duration of each appointment in minutes';
COMMENT ON COLUMN appointment_series.priority IS 'Priority level: low, medium, high';