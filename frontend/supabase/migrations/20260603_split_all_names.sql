-- ============================================================
-- Combined Migration: Split name → first_name/last_name
-- For: apartment_owners, tenants (apartment_managers already migrated)
-- Also includes: apartment_id on managers + performance indexes
-- 
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ============================================================
-- STEP 1: Add apartment_id to apartment_managers (branch assignment)
-- ============================================================
ALTER TABLE apartment_managers
  ADD COLUMN IF NOT EXISTS apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_apartment_managers_apartment_id
  ON apartment_managers(apartment_id);

-- Backfill: set apartment_id from any existing unit assignment
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

-- ============================================================
-- STEP 2: Performance indexes (safe IF NOT EXISTS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_payments_apartmentowner_status ON payments(apartmentowner_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_period_from ON payments(period_from);
CREATE INDEX IF NOT EXISTS idx_payments_unit_id ON payments(unit_id);
CREATE INDEX IF NOT EXISTS idx_tenants_apartmentowner_id ON tenants(apartmentowner_id);
CREATE INDEX IF NOT EXISTS idx_apartment_managers_apartmentowner_id ON apartment_managers(apartmentowner_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_unit_status ON maintenance(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_apartmentowner_id ON maintenance(apartmentowner_id);
CREATE INDEX IF NOT EXISTS idx_documents_apartmentowner_id ON documents(apartmentowner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);

-- ============================================================
-- STEP 3: Split apartment_owners.name → first_name + last_name
-- ============================================================
ALTER TABLE apartment_owners
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

UPDATE apartment_owners
SET
  first_name = SPLIT_PART(name, ' ', 1),
  last_name  = CASE
    WHEN POSITION(' ' IN name) > 0 THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
    ELSE ''
  END
WHERE name IS NOT NULL AND first_name IS NULL;

ALTER TABLE apartment_owners ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE apartment_owners ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE apartment_owners ALTER COLUMN last_name SET DEFAULT '';

ALTER TABLE apartment_owners DROP COLUMN IF EXISTS name;

-- ============================================================
-- STEP 4: Split tenants.name → first_name + last_name
-- ============================================================
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

UPDATE tenants
SET
  first_name = SPLIT_PART(name, ' ', 1),
  last_name  = CASE
    WHEN POSITION(' ' IN name) > 0 THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
    ELSE ''
  END
WHERE name IS NOT NULL AND first_name IS NULL;

ALTER TABLE tenants ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE tenants ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE tenants ALTER COLUMN last_name SET DEFAULT '';

ALTER TABLE tenants DROP COLUMN IF EXISTS name;

-- ============================================================
-- Done! All 3 tables now use first_name + last_name.
-- ============================================================
