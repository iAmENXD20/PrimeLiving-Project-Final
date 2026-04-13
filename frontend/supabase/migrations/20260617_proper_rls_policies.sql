-- ============================================================
-- Proper Row Level Security (RLS) Policies
-- Replaces the "allow all" policies with role-based access
-- ============================================================
-- Backend uses supabaseAdmin (service_role) which bypasses RLS.
-- These policies protect direct frontend Supabase calls (anon key).
-- ============================================================

-- Helper function: get the owner profile ID for the current auth user
CREATE OR REPLACE FUNCTION get_my_owner_id()
RETURNS UUID AS $$
  SELECT id FROM apartment_owners WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get the manager profile ID for the current auth user
CREATE OR REPLACE FUNCTION get_my_manager_id()
RETURNS UUID AS $$
  SELECT id FROM apartment_managers WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get the tenant profile ID for the current auth user
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID AS $$
  SELECT id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get the apartmentowner_id that the current manager belongs to
CREATE OR REPLACE FUNCTION get_my_manager_owner_id()
RETURNS UUID AS $$
  SELECT apartmentowner_id FROM apartment_managers WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get the apartment_id assigned to the current manager
CREATE OR REPLACE FUNCTION get_my_manager_apartment_id()
RETURNS UUID AS $$
  SELECT apartment_id FROM apartment_managers WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get the apartmentowner_id that the current tenant belongs to
CREATE OR REPLACE FUNCTION get_my_tenant_owner_id()
RETURNS UUID AS $$
  SELECT apartmentowner_id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get the unit_id of the current tenant (bypasses tenants RLS)
CREATE OR REPLACE FUNCTION get_my_tenant_unit_id()
RETURNS UUID AS $$
  SELECT unit_id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get the apartment_id of the current tenant (bypasses tenants RLS)
CREATE OR REPLACE FUNCTION get_my_tenant_apartment_id()
RETURNS UUID AS $$
  SELECT apartment_id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Drop all existing "allow all" policies
-- ============================================================
DROP POLICY IF EXISTS "Allow all access to apartment_owners" ON apartment_owners;
DROP POLICY IF EXISTS "Allow all access to apartment_managers" ON apartment_managers;
DROP POLICY IF EXISTS "Allow all access to apartments" ON apartments;
DROP POLICY IF EXISTS "Allow all access to units" ON units;
DROP POLICY IF EXISTS "Allow all access to tenants" ON tenants;
DROP POLICY IF EXISTS "Allow all access to maintenance" ON maintenance;
DROP POLICY IF EXISTS "Allow all access to revenues" ON revenues;
DROP POLICY IF EXISTS "Allow all access to documents" ON documents;
DROP POLICY IF EXISTS "Allow all access to announcements" ON announcements;
DROP POLICY IF EXISTS "Allow all access to payments" ON payments;
DROP POLICY IF EXISTS "Allow all access to notifications" ON notifications;
DROP POLICY IF EXISTS "Allow all access to sms_logs" ON sms_logs;
DROP POLICY IF EXISTS "Allow all access to apartment_logs" ON apartment_logs;
DROP POLICY IF EXISTS "Allow all access to unit_occupants" ON unit_occupants;

-- ============================================================
-- APARTMENT_OWNERS policies
-- Owners can read/update their own record
-- ============================================================
CREATE POLICY "owners_select_own"
  ON apartment_owners FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "owners_update_own"
  ON apartment_owners FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- ============================================================
-- APARTMENT_MANAGERS policies
-- Managers can see/update their own record
-- Owners can see managers under them
-- ============================================================
CREATE POLICY "managers_select_own"
  ON apartment_managers FOR SELECT
  USING (
    auth_user_id = auth.uid()
    OR apartmentowner_id = get_my_owner_id()
  );

CREATE POLICY "managers_update_own"
  ON apartment_managers FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- ============================================================
-- APARTMENTS (property level) policies
-- Owners can see their properties
-- Managers can see properties they are assigned to
-- Tenants can see the property they belong to
-- ============================================================
CREATE POLICY "apartments_select"
  ON apartments FOR SELECT
  USING (
    apartmentowner_id = get_my_owner_id()
    OR id = get_my_manager_apartment_id()
    OR id = get_my_tenant_apartment_id()
  );

-- ============================================================
-- UNITS policies
-- Owners see all their units
-- Managers see units under their assigned apartment
-- Tenants see only their own unit
-- ============================================================
CREATE POLICY "units_select"
  ON units FOR SELECT
  USING (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id = get_my_manager_apartment_id()
    OR id = get_my_tenant_unit_id()
  );

-- ============================================================
-- UNIT_OCCUPANTS policies
-- ============================================================
ALTER TABLE unit_occupants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "occupants_select"
  ON unit_occupants FOR SELECT
  USING (
    unit_id IN (
      SELECT id FROM units WHERE apartmentowner_id = get_my_owner_id()
    )
    OR unit_id IN (
      SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id()
    )
    OR tenant_id = get_my_tenant_id()
  );

-- ============================================================
-- TENANTS policies
-- Tenants can see/update their own record
-- Owners can see tenants under them
-- Managers can see tenants in units under their apartment
-- ============================================================
CREATE POLICY "tenants_select"
  ON tenants FOR SELECT
  USING (
    auth_user_id = auth.uid()
    OR apartmentowner_id = get_my_owner_id()
    OR unit_id IN (
      SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id()
    )
  );

CREATE POLICY "tenants_update_own"
  ON tenants FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- ============================================================
-- MAINTENANCE policies
-- Tenants see their own requests
-- Managers see requests for units in their apartment
-- Owners see all requests under them
-- ============================================================
CREATE POLICY "maintenance_select"
  ON maintenance FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    OR apartmentowner_id = get_my_owner_id()
    OR unit_id IN (
      SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id()
    )
  );

CREATE POLICY "maintenance_insert_tenant"
  ON maintenance FOR INSERT
  WITH CHECK (
    tenant_id = get_my_tenant_id()
  );

-- ============================================================
-- PAYMENTS policies
-- Tenants see their own payments
-- Managers see payments for units in their apartment
-- Owners see all payments under them
-- ============================================================
CREATE POLICY "payments_select"
  ON payments FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    OR apartmentowner_id = get_my_owner_id()
    OR unit_id IN (
      SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id()
    )
  );

CREATE POLICY "payments_insert_tenant"
  ON payments FOR INSERT
  WITH CHECK (
    tenant_id = get_my_tenant_id()
  );

CREATE POLICY "payments_update_own"
  ON payments FOR UPDATE
  USING (
    tenant_id = get_my_tenant_id()
    OR apartmentowner_id = get_my_owner_id()
    OR unit_id IN (
      SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id()
    )
  );

-- ============================================================
-- DOCUMENTS policies
-- Tenants see documents assigned to them
-- Managers see documents for their apartment
-- Owners see all documents under them
-- ============================================================
CREATE POLICY "documents_select"
  ON documents FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    OR apartmentowner_id = get_my_owner_id()
    OR apartment_id IN (
      SELECT apartment_id FROM apartment_managers WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- ANNOUNCEMENTS policies
-- Tenants see announcements targeting them (or all tenants)
-- Managers see announcements for their apartment
-- Owners see all announcements under them
-- ============================================================
CREATE POLICY "announcements_select"
  ON announcements FOR SELECT
  USING (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id = get_my_manager_apartment_id()
    OR (
      apartmentowner_id = get_my_tenant_owner_id()
      AND (
        recipient_tenant_ids IS NULL
        OR get_my_tenant_id() = ANY(recipient_tenant_ids)
      )
    )
  );

-- ============================================================
-- NOTIFICATIONS policies
-- Users see only notifications addressed to them
-- ============================================================
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (
    recipient_id = (
      COALESCE(get_my_owner_id(), get_my_manager_id(), get_my_tenant_id())
    )
  );

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (
    recipient_id = (
      COALESCE(get_my_owner_id(), get_my_manager_id(), get_my_tenant_id())
    )
  );

-- ============================================================
-- REVENUES policies
-- Owners see their revenues
-- Managers see revenues for their apartment
-- ============================================================
CREATE POLICY "revenues_select"
  ON revenues FOR SELECT
  USING (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id = get_my_manager_apartment_id()
  );

-- ============================================================
-- SMS_LOGS policies
-- Owners can see SMS logs for their apartments
-- ============================================================
CREATE POLICY "sms_logs_select"
  ON sms_logs FOR SELECT
  USING (
    apartment_id IN (
      SELECT id FROM apartments WHERE apartmentowner_id = get_my_owner_id()
    )
  );

-- ============================================================
-- APARTMENT_LOGS policies
-- Owners see logs under them
-- Managers see logs for their apartment
-- ============================================================
CREATE POLICY "apartment_logs_select"
  ON apartment_logs FOR SELECT
  USING (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id = get_my_manager_apartment_id()
  );
