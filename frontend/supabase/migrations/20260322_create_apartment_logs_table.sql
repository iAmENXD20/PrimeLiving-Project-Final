-- ============================================================
-- Create apartment_logs table with Arc ID (AR-001, AR-002, etc.)
-- ============================================================

-- Sequence for auto-incrementing arc numbers
CREATE SEQUENCE IF NOT EXISTS apartment_logs_arc_seq START 1;

CREATE TABLE IF NOT EXISTS apartment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  arc_id TEXT NOT NULL DEFAULT 'AR-' || LPAD(nextval('apartment_logs_arc_seq')::text, 3, '0'),
  apartmentowner_id UUID REFERENCES apartment_owners(id) ON DELETE CASCADE,
  apartment_id UUID,
  actor_id UUID,
  actor_name TEXT NOT NULL,
  actor_role TEXT CHECK (actor_role IN ('owner', 'manager', 'tenant', 'system')),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_apartment_logs_arc_id ON apartment_logs(arc_id);
CREATE INDEX IF NOT EXISTS idx_apartment_logs_apartmentowner_id ON apartment_logs(apartmentowner_id);
CREATE INDEX IF NOT EXISTS idx_apartment_logs_apartment_id ON apartment_logs(apartment_id);
CREATE INDEX IF NOT EXISTS idx_apartment_logs_created_at ON apartment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apartment_logs_action ON apartment_logs(action);
CREATE INDEX IF NOT EXISTS idx_apartment_logs_entity_type ON apartment_logs(entity_type);

-- Enable RLS (same pattern as other tables)
ALTER TABLE apartment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to apartment_logs" ON apartment_logs FOR ALL USING (true) WITH CHECK (true);
