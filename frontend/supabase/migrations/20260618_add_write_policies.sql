-- ============================================================
-- Fix: Add INSERT/UPDATE/DELETE policies for write operations
-- The current RLS policies only have SELECT + limited UPDATE.
-- Backend uses service_role (which bypasses RLS), but adding
-- proper write policies ensures reliability.
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

-- ── APARTMENT_MANAGERS: Owners can insert/update/delete their managers ──
DROP POLICY IF EXISTS "managers_insert_by_owner" ON apartment_managers;
CREATE POLICY "managers_insert_by_owner" ON apartment_managers FOR INSERT
  WITH CHECK (
    apartmentowner_id = get_my_owner_id()
    OR auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "managers_delete_by_owner" ON apartment_managers;
CREATE POLICY "managers_delete_by_owner" ON apartment_managers FOR DELETE
  USING (apartmentowner_id = get_my_owner_id());

-- Also allow owners to update managers under them (existing policy only allows self-update)
DROP POLICY IF EXISTS "managers_update_by_owner" ON apartment_managers;
CREATE POLICY "managers_update_by_owner" ON apartment_managers FOR UPDATE
  USING (apartmentowner_id = get_my_owner_id())
  WITH CHECK (apartmentowner_id = get_my_owner_id());

-- ── APARTMENTS: Owners can insert/update/delete their properties ──
DROP POLICY IF EXISTS "apartments_insert_by_owner" ON apartments;
CREATE POLICY "apartments_insert_by_owner" ON apartments FOR INSERT
  WITH CHECK (apartmentowner_id = get_my_owner_id());

DROP POLICY IF EXISTS "apartments_update_by_owner" ON apartments;
CREATE POLICY "apartments_update_by_owner" ON apartments FOR UPDATE
  USING (apartmentowner_id = get_my_owner_id())
  WITH CHECK (apartmentowner_id = get_my_owner_id());

DROP POLICY IF EXISTS "apartments_delete_by_owner" ON apartments;
CREATE POLICY "apartments_delete_by_owner" ON apartments FOR DELETE
  USING (apartmentowner_id = get_my_owner_id());

-- ── UNITS: Owners can insert/update/delete; managers can update their assigned units ──
DROP POLICY IF EXISTS "units_insert_by_owner" ON units;
CREATE POLICY "units_insert_by_owner" ON units FOR INSERT
  WITH CHECK (apartmentowner_id = get_my_owner_id());

DROP POLICY IF EXISTS "units_update_by_owner_or_manager" ON units;
CREATE POLICY "units_update_by_owner_or_manager" ON units FOR UPDATE
  USING (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id = get_my_manager_apartment_id()
  )
  WITH CHECK (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id = get_my_manager_apartment_id()
  );

DROP POLICY IF EXISTS "units_delete_by_owner" ON units;
CREATE POLICY "units_delete_by_owner" ON units FOR DELETE
  USING (apartmentowner_id = get_my_owner_id());

-- ── TENANTS: Owners/managers can insert; owners can delete ──
DROP POLICY IF EXISTS "tenants_insert_by_owner_or_manager" ON tenants;
CREATE POLICY "tenants_insert_by_owner_or_manager" ON tenants FOR INSERT
  WITH CHECK (
    apartmentowner_id = get_my_owner_id()
    OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
  );

DROP POLICY IF EXISTS "tenants_update_by_owner_or_manager" ON tenants;
CREATE POLICY "tenants_update_by_owner_or_manager" ON tenants FOR UPDATE
  USING (
    apartmentowner_id = get_my_owner_id()
    OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
  )
  WITH CHECK (
    apartmentowner_id = get_my_owner_id()
    OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
  );

DROP POLICY IF EXISTS "tenants_delete_by_owner" ON tenants;
CREATE POLICY "tenants_delete_by_owner" ON tenants FOR DELETE
  USING (apartmentowner_id = get_my_owner_id());

-- ── UNIT_OCCUPANTS: Tenants/managers/owners can manage occupants ──
DROP POLICY IF EXISTS "occupants_insert" ON unit_occupants;
CREATE POLICY "occupants_insert" ON unit_occupants FOR INSERT
  WITH CHECK (
    tenant_id = get_my_tenant_id()
    OR unit_id IN (SELECT id FROM units WHERE apartmentowner_id = get_my_owner_id())
    OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
  );

DROP POLICY IF EXISTS "occupants_update" ON unit_occupants;
CREATE POLICY "occupants_update" ON unit_occupants FOR UPDATE
  USING (
    tenant_id = get_my_tenant_id()
    OR unit_id IN (SELECT id FROM units WHERE apartmentowner_id = get_my_owner_id())
    OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
  );

DROP POLICY IF EXISTS "occupants_delete" ON unit_occupants;
CREATE POLICY "occupants_delete" ON unit_occupants FOR DELETE
  USING (
    tenant_id = get_my_tenant_id()
    OR unit_id IN (SELECT id FROM units WHERE apartmentowner_id = get_my_owner_id())
    OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
  );

-- ── MAINTENANCE: Update/delete by owner/manager ──
DROP POLICY IF EXISTS "maintenance_update" ON maintenance;
CREATE POLICY "maintenance_update" ON maintenance FOR UPDATE
  USING (
    tenant_id = get_my_tenant_id()
    OR apartmentowner_id = get_my_owner_id()
    OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
  );

DROP POLICY IF EXISTS "maintenance_delete" ON maintenance;
CREATE POLICY "maintenance_delete" ON maintenance FOR DELETE
  USING (
    apartmentowner_id = get_my_owner_id()
    OR unit_id IN (SELECT id FROM units WHERE apartment_id = get_my_manager_apartment_id())
  );

-- ── PAYMENTS: Delete by owner ──
DROP POLICY IF EXISTS "payments_delete_by_owner" ON payments;
CREATE POLICY "payments_delete_by_owner" ON payments FOR DELETE
  USING (apartmentowner_id = get_my_owner_id());

-- ── DOCUMENTS: Insert/delete by owner/manager ──
DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents FOR INSERT
  WITH CHECK (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id IN (SELECT apartment_id FROM apartment_managers WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents FOR UPDATE
  USING (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id IN (SELECT apartment_id FROM apartment_managers WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "documents_delete" ON documents;
CREATE POLICY "documents_delete" ON documents FOR DELETE
  USING (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id IN (SELECT apartment_id FROM apartment_managers WHERE auth_user_id = auth.uid())
  );

-- ── ANNOUNCEMENTS: Insert/update/delete by owner/manager ──
DROP POLICY IF EXISTS "announcements_insert" ON announcements;
CREATE POLICY "announcements_insert" ON announcements FOR INSERT
  WITH CHECK (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id = get_my_manager_apartment_id()
  );

DROP POLICY IF EXISTS "announcements_update" ON announcements;
CREATE POLICY "announcements_update" ON announcements FOR UPDATE
  USING (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id = get_my_manager_apartment_id()
  );

DROP POLICY IF EXISTS "announcements_delete" ON announcements;
CREATE POLICY "announcements_delete" ON announcements FOR DELETE
  USING (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id = get_my_manager_apartment_id()
  );

-- ── NOTIFICATIONS: Insert by system/any role, delete by recipient ──
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  USING (recipient_id = COALESCE(get_my_owner_id(), get_my_manager_id(), get_my_tenant_id()));

-- ── REVENUES: Insert by owner/manager ──
DROP POLICY IF EXISTS "revenues_insert" ON revenues;
CREATE POLICY "revenues_insert" ON revenues FOR INSERT
  WITH CHECK (
    apartmentowner_id = get_my_owner_id()
    OR apartment_id = get_my_manager_apartment_id()
  );

-- ── SMS_LOGS: Insert allowed for any authenticated user ──
DROP POLICY IF EXISTS "sms_logs_insert" ON sms_logs;
CREATE POLICY "sms_logs_insert" ON sms_logs FOR INSERT
  WITH CHECK (true);

-- ── APARTMENT_LOGS: Insert allowed for any authenticated user ──
DROP POLICY IF EXISTS "apartment_logs_insert" ON apartment_logs;
CREATE POLICY "apartment_logs_insert" ON apartment_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- Done! All tables now have proper INSERT/UPDATE/DELETE policies.
-- ============================================================
