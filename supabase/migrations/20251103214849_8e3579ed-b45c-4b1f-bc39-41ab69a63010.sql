-- Add insurance card image URL columns to insurance_information table
ALTER TABLE insurance_information
ADD COLUMN IF NOT EXISTS insurance_card_front_url TEXT,
ADD COLUMN IF NOT EXISTS insurance_card_back_url TEXT;

-- Create insurance-cards storage bucket for client-uploaded insurance cards
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'insurance-cards',
  'insurance-cards',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for insurance-cards bucket
-- Clients can upload their own insurance card images
CREATE POLICY "Clients can upload their insurance cards"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'insurance-cards'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM customers WHERE client_user_id = auth.uid()
  )
);

-- Clients can view their own insurance card images
CREATE POLICY "Clients can view their insurance cards"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'insurance-cards'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM customers WHERE client_user_id = auth.uid()
  )
);

-- Clients can update their own insurance card images
CREATE POLICY "Clients can update their insurance cards"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'insurance-cards'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM customers WHERE client_user_id = auth.uid()
  )
);

-- Clients can delete their own insurance card images
CREATE POLICY "Clients can delete their insurance cards"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'insurance-cards'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM customers WHERE client_user_id = auth.uid()
  )
);

-- Staff can view all insurance cards in their tenant
CREATE POLICY "Staff can view tenant insurance cards"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'insurance-cards'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM customers WHERE tenant_id = (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  )
  AND EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'staff'
  )
);