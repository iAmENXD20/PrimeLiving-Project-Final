-- Add max_occupancy column to units table
-- Allows apartment owners to set maximum tenant count per unit
ALTER TABLE units ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT NULL;
