-- ============================================================
-- PrimeLiving Database Schema (v5)
-- Current state reflecting all migrations applied
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

-- ============================================================
-- 1. APARTMENT_OWNERS table (Apartment Owners / Clients)
-- ============================================================
CREATE TABLE apartment_owners (
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
-- 2. APARTMENT_MANAGERS table (Managers - work under an owner)
-- ============================================================
CREATE TABLE apartment_managers (
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

CREATE INDEX idx_apartment_managers_apartmentowner_id ON apartment_managers(apartmentowner_id);
CREATE INDEX idx_apartment_managers_apartment_id ON apartment_managers(apartment_id);

-- ============================================================
-- 3. APARTMENTS table (Property / Building level)
-- ============================================================
CREATE TABLE apartments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_apartments_apartmentowner_id ON apartments(apartmentowner_id);

-- ============================================================
-- 4. UNITS table (Rentable units under an apartment/property)
-- ============================================================
CREATE TABLE units (
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

CREATE INDEX idx_units_apartment_id ON units(apartment_id);
CREATE INDEX idx_units_apartmentowner_id ON units(apartmentowner_id);

-- ============================================================
-- 5. TENANTS table
-- ============================================================
CREATE TABLE tenants (
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

CREATE INDEX idx_tenants_unit_id ON tenants(unit_id);
CREATE INDEX idx_tenants_apartmentowner_id ON tenants(apartmentowner_id);

-- ============================================================
-- 6. MAINTENANCE table (Tenant maintenance requests)
-- ============================================================
CREATE TABLE maintenance (
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

CREATE INDEX idx_maintenance_unit_status ON maintenance(unit_id, status);
CREATE INDEX idx_maintenance_apartmentowner_id ON maintenance(apartmentowner_id);

-- ============================================================
-- 8. REVENUES table (Monthly apartment revenue tracking)
-- ============================================================
CREATE TABLE revenues (
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
CREATE TABLE documents (
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

CREATE INDEX idx_documents_apartmentowner_id ON documents(apartmentowner_id);

-- ============================================================
-- 10. ANNOUNCEMENTS table (Owner/Manager notices)
-- ============================================================
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE CASCADE,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by TEXT,
  recipient_tenant_ids UUID[] NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_announcements_apartment_id ON announcements(apartment_id);

-- ============================================================
-- 11. PAYMENTS table (Tenant payment records)
-- ============================================================
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'overdue')),
  description TEXT,
  payment_mode TEXT DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'qr')),
  receipt_url TEXT,
  verification_status TEXT DEFAULT NULL CHECK (verification_status IN ('pending_verification', 'verified', 'approved', 'rejected')),
  period_from DATE,
  period_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_apartmentowner_status ON payments(apartmentowner_id, status);
CREATE INDEX idx_payments_period_from ON payments(period_from);
CREATE INDEX idx_payments_unit_id ON payments(unit_id);

-- ============================================================
-- 12. NOTIFICATIONS table (In-app notifications)
-- ============================================================
CREATE TABLE notifications (
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

CREATE INDEX idx_notifications_apartment_id ON notifications(apartment_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read);

-- ============================================================
-- 13. SMS_LOGS table (SMS delivery audit trail)
-- ============================================================
CREATE TABLE sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_logs_apartment_id ON sms_logs(apartment_id);

-- ============================================================
-- 14. APARTMENT_LOGS table (Activity tracking / audit logs)
-- ============================================================
CREATE TABLE apartment_logs (
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

CREATE INDEX idx_apartment_logs_apartmentowner_id ON apartment_logs(apartmentowner_id);
CREATE INDEX idx_apartment_logs_created_at ON apartment_logs(created_at DESC);

-- ============================================================
-- Enable Row Level Security (RLS)
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

-- RLS Policies: allow full access for authenticated users
CREATE POLICY "Allow all access to apartment_owners" ON apartment_owners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to apartment_managers" ON apartment_managers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to apartments" ON apartments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to units" ON units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tenants" ON tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to maintenance" ON maintenance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to revenues" ON revenues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to documents" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to announcements" ON announcements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to sms_logs" ON sms_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to apartment_logs" ON apartment_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Note: Password management is handled via Supabase Auth.
-- Use supabase.auth.updateUser({ password }) from the client.
-- ============================================================
