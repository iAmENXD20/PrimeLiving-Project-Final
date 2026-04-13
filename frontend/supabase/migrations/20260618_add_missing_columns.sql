-- ============================================================
-- Migration: Add Missing Columns
-- Fixes: "column apartments_1.address does not exist" errors
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent
-- ============================================================

-- ── APARTMENTS table: add 'address' combined field ──────────
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS address TEXT;

-- Populate 'address' from existing address components (for existing rows)
UPDATE apartments 
SET address = CONCAT_WS(', ',
  NULLIF(address_street, ''),
  NULLIF(address_barangay, ''),
  NULLIF(address_city, ''),
  NULLIF(address_province, ''),
  NULLIF(address_region, '')
)
WHERE address IS NULL 
  AND (address_street IS NOT NULL OR address_city IS NOT NULL OR address_province IS NOT NULL);

-- ── APARTMENT_MANAGERS table: ensure all expected columns ───
ALTER TABLE apartment_managers ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE apartment_managers ADD COLUMN IF NOT EXISTS id_type_other TEXT;
ALTER TABLE apartment_managers ADD COLUMN IF NOT EXISTS id_front_photo_url TEXT;
ALTER TABLE apartment_managers ADD COLUMN IF NOT EXISTS id_back_photo_url TEXT;
ALTER TABLE apartment_managers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ── TENANTS table: ensure all expected columns ──────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS id_type_other TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS id_front_photo_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS id_back_photo_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS move_in_date TIMESTAMPTZ DEFAULT NOW();

-- ── UNITS table: ensure all expected columns ────────────────
ALTER TABLE units ADD COLUMN IF NOT EXISTS apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES apartment_managers(id) ON DELETE SET NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS total_units INTEGER DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS payment_due_day INTEGER DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT NULL;

-- ── PAYMENTS table: ensure all expected columns ─────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'cash';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS period_from DATE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS period_to DATE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL;

-- ── DOCUMENTS table: ensure all expected columns ────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'application/pdf';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL;

-- ── ANNOUNCEMENTS table: ensure all expected columns ────────
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS recipient_tenant_ids UUID[] NULL;

-- ── MAINTENANCE table: ensure all expected columns ──────────
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ── REVENUES table: ensure all expected columns ─────────────
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS description TEXT;

-- Done!
SELECT 'Migration complete: all missing columns added' AS result;
