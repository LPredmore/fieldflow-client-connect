-- Add archival fields to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN archived BOOLEAN DEFAULT false,
  ADD COLUMN archived_at TIMESTAMPTZ,
  ADD COLUMN archived_by_user_id UUID REFERENCES public.profiles(user_id);

-- Create index for performance
CREATE INDEX idx_profiles_archived ON public.profiles(archived) WHERE archived = false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.archived IS 'Soft delete flag - user is archived but data preserved. Auth access removed but clinical data remains.';
COMMENT ON COLUMN public.profiles.archived_at IS 'Timestamp when user was archived';
COMMENT ON COLUMN public.profiles.archived_by_user_id IS 'User ID of admin who performed the archive';

-- Update RLS policies to allow admins to view archived users
-- Archived users should still be able to view their own data for historical purposes
CREATE POLICY "Archived users can view their own data"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() AND archived = true
);