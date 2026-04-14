-- ============================================================
-- Migration: Fix Column Name Typos Across All Tables
-- These typos in the database cause "column does not exist" errors
-- because the backend code uses the correct spellings.
-- ============================================================

-- ── 1. apartments: address_are → address_area ───────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'apartments' AND column_name = 'address_are'
  ) THEN
    ALTER TABLE apartments RENAME COLUMN address_are TO address_area;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'apartments' AND column_name = 'address_are_code'
  ) THEN
    ALTER TABLE apartments RENAME COLUMN address_are_code TO address_area_code;
  END IF;
END $$;

-- ── 2. notifications: ricipient_id → recipient_id ───────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'ricipient_id'
  ) THEN
    ALTER TABLE notifications RENAME COLUMN ricipient_id TO recipient_id;
  END IF;
END $$;

-- ── 3. payments: recipient_url → receipt_url ────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'recipient_url'
  ) THEN
    ALTER TABLE payments RENAME COLUMN recipient_url TO receipt_url;
  END IF;
END $$;

-- ── 4. units: montly_rent → monthly_rent ────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'units' AND column_name = 'montly_rent'
  ) THEN
    ALTER TABLE units RENAME COLUMN montly_rent TO monthly_rent;
  END IF;
END $$;

-- ── 5. tenants: aparment_id → apartment_id ──────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'aparment_id'
  ) THEN
    ALTER TABLE tenants RENAME COLUMN aparment_id TO apartment_id;
  END IF;
END $$;

-- ── 6. documents: updated_by → uploaded_by ──────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE documents RENAME COLUMN updated_by TO uploaded_by;
  END IF;
END $$;

-- ── 7. Table rename: units_occupants → unit_occupants ───────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'units_occupants' AND table_schema = 'public'
  ) THEN
    ALTER TABLE units_occupants RENAME TO unit_occupants;
  END IF;
END $$;

-- Done!
SELECT 'Migration complete: all column typos fixed' AS result;





