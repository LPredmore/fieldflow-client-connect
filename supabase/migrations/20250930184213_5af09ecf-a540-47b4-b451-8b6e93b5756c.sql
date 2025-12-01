-- Rename access_jobs column to access_appointments in user_permissions table
ALTER TABLE public.user_permissions 
RENAME COLUMN access_jobs TO access_appointments;

-- Update existing permissions to use the new column name (data already correct, just renamed)