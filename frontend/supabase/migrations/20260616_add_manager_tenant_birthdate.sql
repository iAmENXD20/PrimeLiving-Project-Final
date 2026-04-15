-- Add birthdate column to apartment_managers and tenants
ALTER TABLE apartment_managers ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS birthdate DATE;
