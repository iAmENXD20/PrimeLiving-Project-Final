-- Migration: Rename client_id to apartmentowner_id across all tables
-- This migration renames the foreign key column to better reflect that it references apartment_owners

-- 1. apartment_managers
ALTER TABLE apartment_managers RENAME COLUMN client_id TO apartmentowner_id;

-- 2. apartments (property-level table)
ALTER TABLE apartments RENAME COLUMN client_id TO apartmentowner_id;

-- 3. units (the canonical unit table, formerly named "apartments")
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE units RENAME COLUMN client_id TO apartmentowner_id;
  END IF;
END $$;

-- 4. tenants
ALTER TABLE tenants RENAME COLUMN client_id TO apartmentowner_id;

-- 5. maintenance (real table; maintenance_requests is a backward-compat view)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'maintenance' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE maintenance RENAME COLUMN client_id TO apartmentowner_id;
  END IF;
END $$;

-- 6. revenues
ALTER TABLE revenues RENAME COLUMN client_id TO apartmentowner_id;

-- 6. documents
ALTER TABLE documents RENAME COLUMN client_id TO apartmentowner_id;

-- 7. announcements
ALTER TABLE announcements RENAME COLUMN client_id TO apartmentowner_id;

-- 8. payments
ALTER TABLE payments RENAME COLUMN client_id TO apartmentowner_id;

-- 9. notifications (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE notifications RENAME COLUMN client_id TO apartmentowner_id;
  END IF;
END $$;

-- 10. sms_logs (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_logs' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE sms_logs RENAME COLUMN client_id TO apartmentowner_id;
  END IF;
END $$;
