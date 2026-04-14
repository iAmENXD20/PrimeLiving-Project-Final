-- Add contract duration and lease period columns to units table
ALTER TABLE units ADD COLUMN IF NOT EXISTS contract_duration INTEGER DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS lease_start DATE DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS lease_end DATE DEFAULT NULL;
