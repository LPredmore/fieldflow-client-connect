-- Phase 1: Add priority column to appointment_occurrences
ALTER TABLE appointment_occurrences
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_appointment_occurrences_priority ON appointment_occurrences(priority);
CREATE INDEX IF NOT EXISTS idx_appointment_occurrences_recurrence_group ON appointment_occurrences(recurrence_group_id) WHERE recurrence_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointment_occurrences_tenant_start ON appointment_occurrences(tenant_id, start_at);

COMMENT ON COLUMN appointment_occurrences.priority IS 'Priority level for the appointment: low, medium, high, urgent';
COMMENT ON COLUMN appointment_occurrences.recurrence_group_id IS 'Groups all instances of a recurring appointment series together';
COMMENT ON COLUMN appointment_occurrences.is_recurring IS 'Marks if this appointment is part of a recurring series';
COMMENT ON COLUMN appointment_occurrences.recurrence_rule IS 'RRule string for displaying/editing the recurrence pattern';
COMMENT ON COLUMN appointment_occurrences.recurrence_edit_mode IS 'Tracks if instance was edited: none, this_only, this_and_future';
COMMENT ON COLUMN appointment_occurrences.timezone IS 'IANA timezone of the original creator for editing context';
COMMENT ON COLUMN appointment_occurrences.original_start_at IS 'Original scheduled start time before any edits';

-- Add comment to mark appointment_series as deprecated
COMMENT ON TABLE appointment_series IS 'DEPRECATED: Legacy table for appointment templates. New appointments use appointment_occurrences only with recurrence_group_id for recurring series. Keep for historical data reference.';