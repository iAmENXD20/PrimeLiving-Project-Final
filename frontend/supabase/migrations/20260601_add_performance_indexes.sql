-- ============================================================
-- Performance Indexes Migration
-- Adds missing indexes on frequently-queried columns
-- ============================================================

-- Payments: queried by apartmentowner_id + status in dashboard views
CREATE INDEX IF NOT EXISTS idx_payments_apartmentowner_status
  ON payments(apartmentowner_id, status);

-- Payments: queried by period_from for monthly billing generation
CREATE INDEX IF NOT EXISTS idx_payments_period_from
  ON payments(period_from);

-- Payments: queried by unit_id for overdue checks and unit payment history
CREATE INDEX IF NOT EXISTS idx_payments_unit_id
  ON payments(unit_id);

-- Tenants: queried by apartmentowner_id for owner dashboards
CREATE INDEX IF NOT EXISTS idx_tenants_apartmentowner_id
  ON tenants(apartmentowner_id);

-- Apartment Managers: queried by apartmentowner_id for manager scoping
CREATE INDEX IF NOT EXISTS idx_apartment_managers_apartmentowner_id
  ON apartment_managers(apartmentowner_id);

-- Maintenance: queried by unit_id + status for maintenance dashboards
CREATE INDEX IF NOT EXISTS idx_maintenance_unit_status
  ON maintenance(unit_id, status);

-- Maintenance: queried by apartmentowner_id for owner/manager dashboards
CREATE INDEX IF NOT EXISTS idx_maintenance_apartmentowner_id
  ON maintenance(apartmentowner_id);

-- Documents: queried by apartmentowner_id
CREATE INDEX IF NOT EXISTS idx_documents_apartmentowner_id
  ON documents(apartmentowner_id);

-- Notifications: queried by recipient for notification fetches
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_id, is_read);
