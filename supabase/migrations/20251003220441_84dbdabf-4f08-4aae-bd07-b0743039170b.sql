-- Remove override_estimated_cost column from appointment_occurrences table
ALTER TABLE appointment_occurrences DROP COLUMN IF EXISTS override_estimated_cost;