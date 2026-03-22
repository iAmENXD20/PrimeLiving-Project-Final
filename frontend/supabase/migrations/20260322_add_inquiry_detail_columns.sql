-- Add separate columns for inquiry form fields
-- Previously these were all concatenated into the 'message' column

ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS apartment_classification TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS street_building TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS barangay TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS city_municipality TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS number_of_units TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS number_of_floors TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS other_property_details TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS age TEXT;

-- Migrate existing data
UPDATE inquiries SET apartment_classification = apartment_name WHERE apartment_name IS NOT NULL;

-- Drop old columns
ALTER TABLE inquiries DROP COLUMN IF EXISTS apartment_name;
ALTER TABLE inquiries DROP COLUMN IF EXISTS message;

-- Rename tables
ALTER TABLE clients RENAME TO apartment_owners;
ALTER TABLE managers RENAME TO apartment_managers;
ALTER POLICY "Allow all access to clients" ON apartment_owners RENAME TO "Allow all access to apartment_owners";
ALTER POLICY "Allow all access to managers" ON apartment_managers RENAME TO "Allow all access to apartment_managers";
