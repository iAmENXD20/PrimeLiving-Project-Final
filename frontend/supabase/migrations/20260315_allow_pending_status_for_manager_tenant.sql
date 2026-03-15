-- Allow pending status for invited managers and tenants
ALTER TABLE managers DROP CONSTRAINT IF EXISTS managers_status_check;
ALTER TABLE managers
ADD CONSTRAINT managers_status_check
CHECK (status IN ('active', 'inactive', 'pending'));

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants
ADD CONSTRAINT tenants_status_check
CHECK (status IN ('active', 'inactive', 'pending'));
