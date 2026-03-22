-- Add inquiry-related columns to apartment_owners table
-- These mirror the inquiry form fields so owner records have full details

ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS age TEXT;
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS apartment_classification TEXT;
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS street_building TEXT;
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS barangay TEXT;
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS city_municipality TEXT;
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS number_of_units TEXT;
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS number_of_floors TEXT;
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS other_property_details TEXT;

-- Back-populate existing records from their inquiry data
UPDATE apartment_owners ao
SET
  sex = i.sex,
  age = i.age,
  apartment_classification = i.apartment_classification,
  street_building = i.street_building,
  barangay = i.barangay,
  province = i.province,
  city_municipality = i.city_municipality,
  zip_code = i.zip_code,
  number_of_units = i.number_of_units,
  number_of_floors = i.number_of_floors,
  other_property_details = i.other_property_details
FROM inquiries i
WHERE i.email = ao.email AND i.status = 'approved';
