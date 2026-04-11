-- ============================================================
-- Add apartment_id (branch) column to apartment_managers
-- This directly links each manager to their assigned apartment branch
-- ============================================================

ALTER TABLE apartment_managers
  ADD COLUMN IF NOT EXISTS apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL;

-- Index for looking up managers by apartment branch
CREATE INDEX IF NOT EXISTS idx_apartment_managers_apartment_id
  ON apartment_managers(apartment_id);

-- Backfill: set apartment_id from the units the manager is assigned to (first match)
UPDATE apartment_managers am
SET apartment_id = sub.apartment_id
FROM (
  SELECT DISTINCT ON (manager_id) manager_id, apartment_id
  FROM units
  WHERE manager_id IS NOT NULL AND apartment_id IS NOT NULL
  ORDER BY manager_id, created_at ASC
) sub
WHERE am.id = sub.manager_id
  AND am.apartment_id IS NULL;
