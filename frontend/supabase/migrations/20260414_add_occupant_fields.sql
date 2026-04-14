-- ============================================================
-- Migration: Add first_name, last_name, sex, phone to unit_occupants
-- Split full_name into first_name + last_name, add sex and phone
-- ============================================================

ALTER TABLE unit_occupants ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE unit_occupants ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT '';
ALTER TABLE unit_occupants ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE unit_occupants ADD COLUMN IF NOT EXISTS phone TEXT;

-- Migrate existing full_name data into first_name/last_name
UPDATE unit_occupants
SET first_name = SPLIT_PART(full_name, ' ', 1),
    last_name = CASE
      WHEN POSITION(' ' IN full_name) > 0
      THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
      ELSE ''
    END
WHERE first_name = '' AND full_name IS NOT NULL AND full_name != '';

SELECT 'Migration complete: occupant fields added' AS result;
