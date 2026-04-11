-- Add 'pending_verification' status to tenants table
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants
ADD CONSTRAINT tenants_status_check
CHECK (status IN ('active', 'inactive', 'pending', 'pending_verification'));
