-- Add service rating columns to maintenance table
-- Separate from review_rating (repairman rating) — this is for the quality of the actual work done
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5);
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS service_comment TEXT;
