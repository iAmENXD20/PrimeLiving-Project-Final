-- Remove unused columns from apartment_owners table
-- These columns were part of the inquiry flow and are no longer used.

ALTER TABLE apartment_owners DROP COLUMN IF EXISTS sex;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS age;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS apartment_classification;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS street_building;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS barangay;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS province;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS city_municipality;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS zip_code;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS number_of_units;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS number_of_floors;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS number_of_rooms;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS other_property_details;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS joined_date;
ALTER TABLE apartment_owners DROP COLUMN IF EXISTS created_at;
