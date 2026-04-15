-- Add sex and birthdate columns to apartment_owners
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('Male', 'Female'));
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS birthdate DATE;
