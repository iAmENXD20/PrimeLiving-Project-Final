-- Add support for targeted tenant recipients in announcements
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS recipient_tenant_ids UUID[] NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_recipient_tenant_ids
ON announcements USING GIN (recipient_tenant_ids);
