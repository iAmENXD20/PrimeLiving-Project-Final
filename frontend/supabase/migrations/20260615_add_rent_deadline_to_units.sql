-- Add rent_deadline date column to units table
-- This allows managers to set a specific rent payment deadline date
ALTER TABLE units ADD COLUMN IF NOT EXISTS rent_deadline DATE DEFAULT NULL;
