-- ============================================================
-- E-AMS Database Schema (v6 - Complete)
-- All tables, indexes, RLS policies, and functions
-- Table order respects foreign key dependencies
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

-- ============================================================
-- 1. APARTMENT_OWNERS table (Apartment Owners / Clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS apartment_owners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  sex TEXT CHECK (sex IN ('Male', 'Female')),
  birthdate DATE,
  payment_info JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. APARTMENTS table (Property / Building level)
-- Must come before apartment_managers (FK dependency)
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
-- 3. APARTMENT_MANAGERS table (Managers - work under an owner)
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
  birthdate DATE,
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
  rent_deadline DATE DEFAULT NULL,
  contract_duration INTEGER DEFAULT NULL,
  lease_start DATE DEFAULT NULL,
  lease_end DATE DEFAULT NULL,
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
  birthdate DATE,
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
-- 5b. UNIT_OCCUPANTS table (Additional occupants per unit)
-- ============================================================
CREATE TABLE IF NOT EXISTS unit_occupants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  birthdate DATE,
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
  maintenance_id TEXT UNIQUE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  photo_url TEXT,
  review_rating INTEGER CHECK (review_rating >= 1 AND review_rating <= 5),
  review_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_unit_status ON maintenance(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_apartmentowner_id ON maintenance(apartmentowner_id);

-- ============================================================
-- 7. REVENUES table (Monthly apartment revenue tracking)
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
-- 8. DOCUMENTS table (Contract / lease files)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  uploaded_by UUID,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'application/pdf',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_apartmentowner_id ON documents(apartmentowner_id);

-- ============================================================
-- 9. ANNOUNCEMENTS table (Owner/Manager notices)
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
-- 10. PAYMENTS table (Tenant payment records)
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
-- 11. NOTIFICATIONS table (In-app notifications)
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
-- 12. SMS_LOGS table (SMS delivery audit trail)
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
-- 13. APARTMENT_LOGS table (Activity tracking / audit logs)
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
-- Enable Row Level Security (RLS)
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
-- RLS Policies: Role-based access per table
-- ============================================================

-- apartment_owners: owners see/update their own record
CREATE POLICY "owners_select_own" ON apartment_owners FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "owners_update_own" ON apartment_owners FOR UPDATE USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- apartment_managers: managers see own record; owners see their managers
CREATE POLICY "managers_select_own" ON apartment_managers FOR SELECT USING (auth_user_id = auth.uid() OR apartmentowner_id = get_my_owner_id());
CREATE POLICY "managers_update_own" ON apartment_managers FOR UPDATE USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- apartments: owners see their properties; managers/tenants see assigned properties
CREATE POLICY "apartments_select" ON apartments FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR id = get_my_manager_apartment_id()
  OR id = get_my_tenant_apartment_id()
);

-- units: owners see all; managers see their apartment's units; tenants see own unit
CREATE POLICY "units_select" ON units FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR apartment_id = get_my_manager_apartment_id()
  OR id = get_my_tenant_unit_id()
);

-- unit_occupants: owners/managers see via units; tenants see their own
CREATE POLICY "occupants_select" ON unit_occupants FOR SELECT USING (
  unit_id IN (SELECT id FROM units WHERE apartmentowner_id = get_my_owner_id())
  OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
  OR tenant_id = get_my_tenant_id()
);

-- tenants: own record, owner sees all, manager sees their apartment's tenants
CREATE POLICY "tenants_select" ON tenants FOR SELECT USING (
  auth_user_id = auth.uid()
  OR apartmentowner_id = get_my_owner_id()
  OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
);
CREATE POLICY "tenants_update_own" ON tenants FOR UPDATE USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- maintenance: tenant sees own, owner/manager see scoped
CREATE POLICY "maintenance_select" ON maintenance FOR SELECT USING (
  tenant_id = get_my_tenant_id()
  OR apartmentowner_id = get_my_owner_id()
  OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
);
CREATE POLICY "maintenance_insert_tenant" ON maintenance FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- payments: tenant sees own, owner/manager see scoped
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

-- documents: tenant sees assigned, owner/manager see scoped
CREATE POLICY "documents_select" ON documents FOR SELECT USING (
  tenant_id = get_my_tenant_id()
  OR apartmentowner_id = get_my_owner_id()
  OR apartment_id IN (SELECT apartment_id FROM apartment_managers WHERE auth_user_id = auth.uid())
);

-- announcements: owner sees all, manager sees apartment, tenant sees targeted/all
CREATE POLICY "announcements_select" ON announcements FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR apartment_id = get_my_manager_apartment_id()
  OR (apartmentowner_id = get_my_tenant_owner_id() AND (recipient_tenant_ids IS NULL OR get_my_tenant_id() = ANY(recipient_tenant_ids)))
);

-- notifications: users see only their own
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (recipient_id = COALESCE(get_my_owner_id(), get_my_manager_id(), get_my_tenant_id()));
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (recipient_id = COALESCE(get_my_owner_id(), get_my_manager_id(), get_my_tenant_id()));

-- revenues: owner/manager see scoped
CREATE POLICY "revenues_select" ON revenues FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR apartment_id = get_my_manager_apartment_id()
);

-- sms_logs: owners see their apartment logs
CREATE POLICY "sms_logs_select" ON sms_logs FOR SELECT USING (
  apartment_id IN (SELECT id FROM apartments WHERE apartmentowner_id = get_my_owner_id())
);

-- apartment_logs: owner sees all, manager sees apartment logs
CREATE POLICY "apartment_logs_select" ON apartment_logs FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR apartment_id = get_my_manager_apartment_id()
);

-- ============================================================
-- Enable Realtime on key tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE apartment_managers;
ALTER PUBLICATION supabase_realtime ADD TABLE tenants;

-- ============================================================
-- Create storage bucket for payment QR codes
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-qr', 'payment-qr', true) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/read QR codes
CREATE POLICY "payment_qr_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-qr' AND auth.role() = 'authenticated');
CREATE POLICY "payment_qr_read" ON storage.objects FOR SELECT USING (bucket_id = 'payment-qr');
