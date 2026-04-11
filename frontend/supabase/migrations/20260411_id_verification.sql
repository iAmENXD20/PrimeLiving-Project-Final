-- ============================================================
-- Add ID verification columns to apartment_managers and tenants
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- apartment_managers
ALTER TABLE apartment_managers
  ADD COLUMN IF NOT EXISTS id_type TEXT,
  ADD COLUMN IF NOT EXISTS id_type_other TEXT,
  ADD COLUMN IF NOT EXISTS id_front_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS id_back_photo_url TEXT;

-- tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS id_type TEXT,
  ADD COLUMN IF NOT EXISTS id_type_other TEXT,
  ADD COLUMN IF NOT EXISTS id_front_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS id_back_photo_url TEXT;

-- ============================================================
-- Done! Both tables now support ID verification data.
-- ============================================================
