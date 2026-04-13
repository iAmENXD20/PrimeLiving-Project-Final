-- ============================================================
-- Fix: RLS Infinite Recursion Between units ↔ tenants
-- The units policy queries tenants and the tenants policy queries units,
-- creating an infinite loop. Fix by using SECURITY DEFINER functions
-- that bypass RLS for cross-table lookups.
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

-- ── New helper functions (SECURITY DEFINER = bypasses RLS) ──

-- Returns the current tenant's unit_id without triggering tenants RLS
CREATE OR REPLACE FUNCTION get_my_tenant_unit_id()
RETURNS UUID AS $$
  SELECT unit_id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the current tenant's apartment_id without triggering tenants RLS
CREATE OR REPLACE FUNCTION get_my_tenant_apartment_id()
RETURNS UUID AS $$
  SELECT apartment_id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Fix units policy (was: subquery on tenants → caused recursion) ──
DROP POLICY IF EXISTS "units_select" ON units;
CREATE POLICY "units_select" ON units FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR apartment_id = get_my_manager_apartment_id()
  OR id = get_my_tenant_unit_id()
);

-- ── Fix apartments policy (was: subquery on tenants → caused recursion) ──
DROP POLICY IF EXISTS "apartments_select" ON apartments;
CREATE POLICY "apartments_select" ON apartments FOR SELECT USING (
  apartmentowner_id = get_my_owner_id()
  OR id = get_my_manager_apartment_id()
  OR id = get_my_tenant_apartment_id()
);

-- ============================================================
-- Done! The circular dependency is broken.
-- units_select no longer queries tenants table directly.
-- apartments_select no longer queries tenants table directly.
-- ============================================================
