-- ============================================================
-- PrimeLiving Database Schema (v5) — SAFE / IDEMPOTENT
-- Can be run on fresh OR existing databases without errors.
-- Skips tables/indexes/policies that already exist.
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

-- ============================================================
-- 1. APARTMENT_OWNERS table (Apartment Owners)
-- ============================================================
CREATE TABLE IF NOT EXISTS apartment_owners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. APARTMENTS table (Property / Building level)
-- Must be created BEFORE apartment_managers (which references it)
-- ============================================================
CREATE TABLE IF NOT EXISTS apartments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address TEXT,
  address_region TEXT,
  address_region_code TEXT,
  address_province TEXT,
  address_province_code TEXT,
  address_city TEXT,
  address_city_code TEXT,
  address_district TEXT,
  address_district_code TEXT,
  address_area TEXT,
  address_area_code TEXT,
  address_barangay TEXT,
  address_barangay_code TEXT,
  address_street TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apartments_apartmentowner_id ON apartments(apartmentowner_id);

-- ============================================================
-- 2. APARTMENT_MANAGERS table (Managers - work under an owner)
-- ============================================================
CREATE TABLE IF NOT EXISTS apartment_managers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  sex TEXT,
  age TEXT,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  id_type TEXT,
  id_type_other TEXT,
  id_front_photo_url TEXT,
  id_back_photo_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'pending_verification')),
  joined_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apartment_managers_apartmentowner_id ON apartment_managers(apartmentowner_id);
CREATE INDEX IF NOT EXISTS idx_apartment_managers_apartment_id ON apartment_managers(apartment_id);

-- ============================================================
-- 4. UNITS table (Rentable units under an apartment/property)
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

-- ============================================================
-- 5. TENANTS table
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT DEFAULT '',
  email TEXT,
  phone TEXT,
  sex TEXT,
  age TEXT,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  id_type TEXT,
  id_type_other TEXT,
  id_front_photo_url TEXT,
  id_back_photo_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'pending_verification')),
  move_in_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_unit_id ON tenants(unit_id);
CREATE INDEX IF NOT EXISTS idx_tenants_apartmentowner_id ON tenants(apartmentowner_id);

-- ============================================================
-- 4b. UNIT_OCCUPANTS table (Additional occupants per unit)
-- ============================================================
CREATE TABLE IF NOT EXISTS unit_occupants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  id_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unit_occupants_unit_id ON unit_occupants(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_occupants_tenant_id ON unit_occupants(tenant_id);

-- ============================================================
-- 6. MAINTENANCE table (Tenant maintenance requests)
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_maintenance_unit_status ON maintenance(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_apartmentowner_id ON maintenance(apartmentowner_id);

-- ============================================================
-- 8. REVENUES table (Monthly apartment revenue tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS revenues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  month DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. DOCUMENTS table (Contract / lease files)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES apartment_managers(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'application/pdf',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_apartmentowner_id ON documents(apartmentowner_id);

-- ============================================================
-- 10. ANNOUNCEMENTS table (Owner/Manager notices)
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE CASCADE,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by TEXT,
  recipient_tenant_ids UUID[] NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_apartment_id ON announcements(apartment_id);

-- ============================================================
-- 11. PAYMENTS table (Tenant payment records)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'overdue')),
  description TEXT,
  payment_mode TEXT DEFAULT 'cash' CHECK (payment_mode IN ('gcash', 'maya', 'cash', 'bank_transfer')),
  receipt_url TEXT,
  verification_status TEXT DEFAULT NULL CHECK (verification_status IN ('pending_verification', 'verified', 'approved', 'rejected')),
  period_from DATE,
  period_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_apartmentowner_status ON payments(apartmentowner_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_period_from ON payments(period_from);
CREATE INDEX IF NOT EXISTS idx_payments_unit_id ON payments(unit_id);

-- ============================================================
-- 12. NOTIFICATIONS table (In-app notifications)
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

CREATE INDEX IF NOT EXISTS idx_notifications_apartment_id ON notifications(apartment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);

-- ============================================================
-- 13. SMS_LOGS table (SMS delivery audit trail)
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

CREATE INDEX IF NOT EXISTS idx_sms_logs_apartment_id ON sms_logs(apartment_id);

-- ============================================================
-- 14. APARTMENT_LOGS table (Activity tracking / audit logs)
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
-- Enable Row Level Security (RLS) on all tables
-- (Safe to re-run — enabling RLS on already-enabled tables is a no-op)
-- ============================================================
ALTER TABLE apartment_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_occupants ENABLE ROW LEVEL SECURITY;
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
-- Helper functions for RLS policies
-- (CREATE OR REPLACE is safe to re-run)
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_owner_id()
RETURNS UUID AS $$
  SELECT id FROM apartment_owners WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_manager_id()
RETURNS UUID AS $$
  SELECT id FROM apartment_managers WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID AS $$
  SELECT id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_manager_owner_id()
RETURNS UUID AS $$
  SELECT apartmentowner_id FROM apartment_managers WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_manager_apartment_id()
RETURNS UUID AS $$
  SELECT apartment_id FROM apartment_managers WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_tenant_owner_id()
RETURNS UUID AS $$
  SELECT apartmentowner_id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_tenant_unit_id()
RETURNS UUID AS $$
  SELECT unit_id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_tenant_apartment_id()
RETURNS UUID AS $$
  SELECT apartment_id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS Policies (DROP IF EXISTS + CREATE to ensure correct state)
-- ============================================================

-- ── APARTMENT_OWNERS ────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to apartment_owners" ON apartment_owners;
DROP POLICY IF EXISTS "owners_select_own" ON apartment_owners;
DROP POLICY IF EXISTS "owners_update_own" ON apartment_owners;
CREATE POLICY "owners_select_own" ON apartment_owners FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "owners_update_own" ON apartment_owners FOR UPDATE USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- ── APARTMENT_MANAGERS ──────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to apartment_managers" ON apartment_managers;
DROP POLICY IF EXISTS "managers_select_own" ON apartment_managers;
DROP POLICY IF EXISTS "managers_update_own" ON apartment_managers;
CREATE POLICY "managers_select_own" ON apartment_managers FOR SELECT USING (auth_user_id = auth.uid() OR apartmentowner_id = get_my_owner_id());
CREATE POLICY "managers_update_own" ON apartment_managers FOR UPDATE USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- ── APARTMENTS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to apartments" ON apartments;
DROP POLICY IF EXISTS "apartments_select" ON apartments;
CREATE POLICY "apartments_select" ON apartments FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR id = get_my_manager_apartment_id()
  OR id = get_my_tenant_apartment_id()
);

-- ── UNITS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to units" ON units;
DROP POLICY IF EXISTS "units_select" ON units;
CREATE POLICY "units_select" ON units FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR apartment_id = get_my_manager_apartment_id()
  OR id = get_my_tenant_unit_id()
);

-- ── UNIT_OCCUPANTS ──────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to unit_occupants" ON unit_occupants;
DROP POLICY IF EXISTS "occupants_select" ON unit_occupants;
CREATE POLICY "occupants_select" ON unit_occupants FOR SELECT USING (
  unit_id IN (SELECT id FROM units WHERE apartmentowner_id = get_my_owner_id())
  OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
  OR tenant_id = get_my_tenant_id()
);

-- ── TENANTS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to tenants" ON tenants;
DROP POLICY IF EXISTS "tenants_select" ON tenants;
DROP POLICY IF EXISTS "tenants_update_own" ON tenants;
CREATE POLICY "tenants_select" ON tenants FOR SELECT USING (
  auth_user_id = auth.uid()
  OR apartmentowner_id = get_my_owner_id()
  OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
);
CREATE POLICY "tenants_update_own" ON tenants FOR UPDATE USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- ── MAINTENANCE ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to maintenance" ON maintenance;
DROP POLICY IF EXISTS "maintenance_select" ON maintenance;
DROP POLICY IF EXISTS "maintenance_insert_tenant" ON maintenance;
CREATE POLICY "maintenance_select" ON maintenance FOR SELECT USING (
  tenant_id = get_my_tenant_id()
  OR apartmentowner_id = get_my_owner_id()
  OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
);
CREATE POLICY "maintenance_insert_tenant" ON maintenance FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- ── PAYMENTS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to payments" ON payments;
DROP POLICY IF EXISTS "payments_select" ON payments;
DROP POLICY IF EXISTS "payments_insert_tenant" ON payments;
DROP POLICY IF EXISTS "payments_update_own" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT USING (
  tenant_id = get_my_tenant_id()
  OR apartmentowner_id = get_my_owner_id()
  OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
);
CREATE POLICY "payments_insert_tenant" ON payments FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "payments_update_own" ON payments FOR UPDATE USING (
  tenant_id = get_my_tenant_id()
  OR apartmentowner_id = get_my_owner_id()
  OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
);

-- ── DOCUMENTS ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to documents" ON documents;
DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents FOR SELECT USING (
  tenant_id = get_my_tenant_id()
  OR apartmentowner_id = get_my_owner_id()
  OR apartment_id IN (SELECT apartment_id FROM apartment_managers WHERE auth_user_id = auth.uid())
);

-- ── ANNOUNCEMENTS ───────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to announcements" ON announcements;
DROP POLICY IF EXISTS "announcements_select" ON announcements;
CREATE POLICY "announcements_select" ON announcements FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR apartment_id = get_my_manager_apartment_id()
  OR (apartmentowner_id = get_my_tenant_owner_id() AND (recipient_tenant_ids IS NULL OR get_my_tenant_id() = ANY(recipient_tenant_ids)))
);

-- ── NOTIFICATIONS ───────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (recipient_id = COALESCE(get_my_owner_id(), get_my_manager_id(), get_my_tenant_id()));
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (recipient_id = COALESCE(get_my_owner_id(), get_my_manager_id(), get_my_tenant_id()));

-- ── REVENUES ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to revenues" ON revenues;
DROP POLICY IF EXISTS "revenues_select" ON revenues;
CREATE POLICY "revenues_select" ON revenues FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR apartment_id = get_my_manager_apartment_id()
);

-- ── SMS_LOGS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to sms_logs" ON sms_logs;
DROP POLICY IF EXISTS "sms_logs_select" ON sms_logs;
CREATE POLICY "sms_logs_select" ON sms_logs FOR SELECT USING (
  apartment_id IN (SELECT id FROM apartments WHERE apartmentowner_id = get_my_owner_id())
);

-- ── APARTMENT_LOGS ──────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to apartment_logs" ON apartment_logs;
DROP POLICY IF EXISTS "apartment_logs_select" ON apartment_logs;
CREATE POLICY "apartment_logs_select" ON apartment_logs FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR apartment_id = get_my_manager_apartment_id()
);

-- ============================================================
-- Ensure CHECK constraints are up to date
-- (Safe to re-run — drops existing constraint if present, then re-creates)
-- ============================================================
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_mode_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_mode_check 
  CHECK (payment_mode IN ('gcash', 'maya', 'cash', 'bank_transfer'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_verification_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_verification_status_check 
  CHECK (verification_status IN ('pending_verification', 'verified', 'approved', 'rejected'));

-- ============================================================
-- Done! Password management is handled via Supabase Auth.
-- Use supabase.auth.updateUser({ password }) from the client.
-- ============================================================
