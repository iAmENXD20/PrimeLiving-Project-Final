-- ============================================================
-- Migration: Add birthdate column to unit_occupants
-- ============================================================

ALTER TABLE unit_occupants ADD COLUMN IF NOT EXISTS birthdate DATE;

SELECT 'Migration complete: birthdate column added to unit_occupants' AS result;
