-- Create storage bucket for verification ID photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-ids', 'verification-ids', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own ID photos
CREATE POLICY "verification_ids_upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'verification-ids'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own ID photos
CREATE POLICY "verification_ids_read_own" ON storage.objects
FOR SELECT USING (
  bucket_id = 'verification-ids'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service role (backend) to read all ID photos for admin review
CREATE POLICY "verification_ids_admin_read" ON storage.objects
FOR SELECT USING (
  bucket_id = 'verification-ids'
  AND auth.role() = 'service_role'
);
