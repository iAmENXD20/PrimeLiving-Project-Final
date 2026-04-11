-- ============================================================
-- PrimeLiving v5 Safe Migration
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Safe to run on existing databases (uses IF NOT EXISTS)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Ensure apartments table exists (property/building level)
-- ============================================================
CREATE TABLE IF NOT EXISTS apartments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apartments_apartmentowner_id ON apartments(apartmentowner_id);

-- ============================================================
-- 2. Ensure units table exists (rentable units under apartments)
-- ============================================================
CREATE TABLE IF NOT EXISTS units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES apartment_managers(id) ON DELETE SET NULL,
  monthly_rent NUMERIC(10,2) DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  payment_due_day INTEGER DEFAULT NULL CHECK (payment_due_day >= 1 AND payment_due_day <= 31),
  max_occupancy INTEGER DEFAULT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_units_apartment_id ON units(apartment_id);
CREATE INDEX IF NOT EXISTS idx_units_apartmentowner_id ON units(apartmentowner_id);

-- Add columns to units if they don't exist yet
ALTER TABLE units ADD COLUMN IF NOT EXISTS apartment_id UUID;
ALTER TABLE units ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS payment_due_day INTEGER DEFAULT NULL;

-- ============================================================
-- 3. Ensure tenants has unit_id column
-- ============================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS unit_id UUID;
CREATE INDEX IF NOT EXISTS idx_tenants_unit_id ON tenants(unit_id);

-- Add FK if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenants_unit_id_fkey'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 4. Ensure payments has unit_id column
-- ============================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS unit_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'cash';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS period_from DATE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS period_to DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_unit_id_fkey'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 5. Ensure maintenance table exists (renamed from maintenance_requests)
-- ============================================================
-- If maintenance_requests exists but maintenance doesn't, rename it
DO $$
BEGIN
  IF to_regclass('public.maintenance') IS NULL AND to_regclass('public.maintenance_requests') IS NOT NULL THEN
    ALTER TABLE maintenance_requests RENAME TO maintenance;
  END IF;
END $$;

-- Create if neither exists
CREATE TABLE IF NOT EXISTS maintenance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unit_id to maintenance if missing
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS unit_id UUID;

-- ============================================================
-- 6. Ensure notifications table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  recipient_role TEXT NOT NULL,
  recipient_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS apartment_id UUID;
CREATE INDEX IF NOT EXISTS idx_notifications_apartment_id ON notifications(apartment_id);

-- ============================================================
-- 7. Ensure sms_logs table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS apartment_id UUID;
CREATE INDEX IF NOT EXISTS idx_sms_logs_apartment_id ON sms_logs(apartment_id);

-- ============================================================
-- 8. Ensure announcements has apartment_id column
-- ============================================================
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS apartment_id UUID;
CREATE INDEX IF NOT EXISTS idx_announcements_apartment_id ON announcements(apartment_id);

-- ============================================================
-- 9. Ensure apartment_logs table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS apartment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE CASCADE,
  apartment_id UUID,
  actor_id UUID,
  actor_name TEXT NOT NULL,
  actor_role TEXT CHECK (actor_role IN ('owner', 'manager', 'tenant', 'system')),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apartment_logs_apartmentowner_id ON apartment_logs(apartmentowner_id);
CREATE INDEX IF NOT EXISTS idx_apartment_logs_created_at ON apartment_logs(created_at DESC);

-- ============================================================
-- 10. Enable RLS on all tables
-- ============================================================
ALTER TABLE apartment_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11. RLS Policies (safe: uses IF NOT EXISTS via DO blocks)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'units' AND policyname = 'Allow all access to units') THEN
    CREATE POLICY "Allow all access to units" ON units FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Allow all access to notifications') THEN
    CREATE POLICY "Allow all access to notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Allow all access to sms_logs') THEN
    CREATE POLICY "Allow all access to sms_logs" ON sms_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance' AND policyname = 'Allow all access to maintenance') THEN
    CREATE POLICY "Allow all access to maintenance" ON maintenance FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'apartments' AND policyname = 'Allow all access to apartments') THEN
    CREATE POLICY "Allow all access to apartments" ON apartments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;
