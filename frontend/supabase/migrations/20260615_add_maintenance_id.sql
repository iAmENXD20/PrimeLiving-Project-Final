-- Add maintenance_id column for tracking reference (format: MR0001)
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS maintenance_id TEXT UNIQUE;

-- Backfill existing rows with sequential IDs based on created_at order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM maintenance
)
UPDATE maintenance
SET maintenance_id = 'MR' || LPAD(numbered.rn::TEXT, 4, '0')
FROM numbered
WHERE maintenance.id = numbered.id;
