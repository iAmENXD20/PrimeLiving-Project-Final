-- Add category to maintenance requests
ALTER TABLE maintenance 
  ADD COLUMN IF NOT EXISTS category TEXT 
    CHECK (category IN ('plumbing','electrical','hvac','structural','appliances','pest_control','cleaning','other')) 
    DEFAULT 'other';

-- Create repairmen table (manager-manageable, no system account)
CREATE TABLE IF NOT EXISTS repairmen (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  apartmentowner_id   UUID        REFERENCES apartment_owners(id) ON DELETE CASCADE NOT NULL,
  name                TEXT        NOT NULL,
  phone               TEXT,
  specialty           TEXT,
  notes               TEXT,
  is_active           BOOLEAN     DEFAULT true NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Assign a repairman to a maintenance request
ALTER TABLE maintenance
  ADD COLUMN IF NOT EXISTS assigned_repairman_id UUID REFERENCES repairmen(id) ON DELETE SET NULL;

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_category          ON maintenance(category);
CREATE INDEX IF NOT EXISTS idx_maintenance_assigned_repairman ON maintenance(assigned_repairman_id);
CREATE INDEX IF NOT EXISTS idx_repairmen_owner               ON repairmen(apartmentowner_id);
CREATE INDEX IF NOT EXISTS idx_repairmen_active              ON repairmen(is_active);

-- RLS for repairmen
ALTER TABLE repairmen ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own repairmen
CREATE POLICY "owner_manage_repairmen" ON repairmen
  FOR ALL
  USING  (apartmentowner_id = auth.uid())
  WITH CHECK (apartmentowner_id = auth.uid());

-- Managers can view repairmen in their owner scope
CREATE POLICY "manager_view_repairmen" ON repairmen
  FOR SELECT
  USING (
    apartmentowner_id IN (
      SELECT owner_id FROM managers WHERE user_id = auth.uid()
    )
  );

-- Updated_at trigger for repairmen
CREATE OR REPLACE FUNCTION update_repairmen_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
$$;

DROP TRIGGER IF EXISTS trg_repairmen_updated_at ON repairmen;
CREATE TRIGGER trg_repairmen_updated_at
  BEFORE UPDATE ON repairmen
  FOR EACH ROW EXECUTE FUNCTION update_repairmen_updated_at();
