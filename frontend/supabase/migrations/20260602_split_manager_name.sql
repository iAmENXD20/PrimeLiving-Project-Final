-- ============================================================
-- Split apartment_managers.name into first_name and last_name
-- ============================================================

-- Add new columns
ALTER TABLE apartment_managers
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Migrate data: split existing name into first_name (first word) and last_name (rest)
UPDATE apartment_managers
SET
  first_name = SPLIT_PART(name, ' ', 1),
  last_name  = CASE
    WHEN POSITION(' ' IN name) > 0 THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
    ELSE ''
  END
WHERE name IS NOT NULL AND first_name IS NULL;

-- Make first_name NOT NULL after migration
ALTER TABLE apartment_managers ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE apartment_managers ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE apartment_managers ALTER COLUMN last_name SET DEFAULT '';

-- Drop old name column
ALTER TABLE apartment_managers DROP COLUMN IF EXISTS name;
