-- Add sex and age columns to apartment_managers
ALTER TABLE apartment_managers ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE apartment_managers ADD COLUMN IF NOT EXISTS age TEXT;

-- Add sex and age columns to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS age TEXT;
