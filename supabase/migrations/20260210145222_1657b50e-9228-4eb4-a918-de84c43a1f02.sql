
-- Add cover_image_url column to training_videos
ALTER TABLE public.training_videos ADD COLUMN cover_image_url text;

-- Create training-covers storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-covers', 'training-covers', true);

-- Public read access
CREATE POLICY "Training covers are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'training-covers');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload training covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'training-covers');

-- Authenticated users can update their uploads
CREATE POLICY "Authenticated users can update training covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'training-covers');

-- Authenticated users can delete training covers
CREATE POLICY "Authenticated users can delete training covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'training-covers');
