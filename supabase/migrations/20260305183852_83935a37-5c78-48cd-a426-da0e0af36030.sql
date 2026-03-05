
-- Create storage bucket for document files
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Allow authenticated users to upload to documents bucket
CREATE POLICY "Admins can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  public.has_role(auth.uid(), 'admin')
);

-- Allow authenticated users to read from documents bucket  
CREATE POLICY "Authenticated can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow admins to delete from documents bucket
CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.has_role(auth.uid(), 'admin')
);

-- Add delete policy for document_chunks when parent document is deleted
CREATE POLICY "Admins can delete chunks"
ON public.document_chunks FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
