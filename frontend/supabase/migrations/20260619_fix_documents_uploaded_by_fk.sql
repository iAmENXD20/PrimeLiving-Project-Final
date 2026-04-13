-- Drop the uploaded_by FK to apartment_managers so owners can also upload documents
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey;
