-- ============================================================
-- Migration: Add review columns to maintenance table
-- Allows tenants to rate and review resolved maintenance requests
-- ============================================================

ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS review_rating INTEGER CHECK (review_rating >= 1 AND review_rating <= 5);
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS review_comment TEXT;
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

SELECT 'Migration complete: review columns added to maintenance' AS result;
