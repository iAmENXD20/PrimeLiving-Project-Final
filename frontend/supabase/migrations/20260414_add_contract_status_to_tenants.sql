-- Add contract_status column to tenants table for tracking lease renewal status
-- Values: 'active' (default), 'expiring', 'renewed', 'expired'
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'active';

-- Add renewal_date to track when the tenant last renewed
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS renewal_date DATE DEFAULT NULL;

-- Add renewal_count to track how many times the tenant has renewed
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS renewal_count INTEGER DEFAULT 0;
