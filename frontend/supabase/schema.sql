-- ============================================================
-- PrimeLiving Database Schema (v4)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Drop existing tables if re-running (remove these lines in production)
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS maintenance_requests CASCADE;
DROP TABLE IF EXISTS revenues CASCADE;
DROP TABLE IF EXISTS inquiries CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS apartments CASCADE;
DROP TABLE IF EXISTS managers CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- 1. CLIENTS table (Apartment Owners — displayed as "Clients" in UI)
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  apartment_address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  joined_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MANAGERS table (Apartment Managers — work under an owner)
CREATE TABLE managers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  joined_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. APARTMENTS table
CREATE TABLE apartments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  monthly_rent NUMERIC(10,2) DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES managers(id) ON DELETE SET NULL,
  payment_due_day INTEGER DEFAULT NULL CHECK (payment_due_day >= 1 AND payment_due_day <= 31),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TENANTS table
CREATE TABLE tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  move_in_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. INQUIRIES table (Landing page inquiries)
CREATE TABLE inquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  apartment_name TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'approved', 'cancelled', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MAINTENANCE_REQUESTS table (Tenant maintenance inquiries)
CREATE TABLE maintenance_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. REVENUES table (Monthly apartment revenue tracking)
CREATE TABLE revenues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  month DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. DOCUMENTS table (Contract / lease files uploaded by managers)
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES managers(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'application/pdf',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Enable Row Level Security (RLS)
-- ============================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policies: allow full access for authenticated users
CREATE POLICY "Allow all access to clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to managers" ON managers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to apartments" ON apartments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tenants" ON tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to inquiries" ON inquiries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to maintenance_requests" ON maintenance_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to revenues" ON revenues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to documents" ON documents FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 9. PAYMENTS table (Tenant payment records)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'overdue')),
  description TEXT,
  payment_mode TEXT DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'qr')),
  receipt_url TEXT,
  verification_status TEXT DEFAULT NULL CHECK (verification_status IN ('pending_verification', 'verified', 'rejected')),
  period_from DATE,
  period_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to payments" ON payments FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Migration: Add new columns to existing payments table
-- Run this if the payments table already exists:
-- ============================================================
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'qr'));
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT NULL CHECK (verification_status IN ('pending_verification', 'verified', 'rejected'));
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS period_from DATE;
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS period_to DATE;

-- ============================================================
-- Migration: Add payment_due_day to apartments table
-- Run this if the apartments table already exists:
-- ============================================================
-- ALTER TABLE apartments ADD COLUMN IF NOT EXISTS payment_due_day INTEGER DEFAULT NULL CHECK (payment_due_day >= 1 AND payment_due_day <= 31);

-- ============================================================
-- Note: Password management is handled via Supabase Auth.
-- Use supabase.auth.updateUser({ password }) from the client.
-- ============================================================
