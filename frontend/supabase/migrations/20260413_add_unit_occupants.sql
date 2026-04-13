-- Create unit_occupants table for tracking additional occupants per unit
CREATE TABLE IF NOT EXISTS unit_occupants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  id_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_unit_occupants_unit_id ON unit_occupants(unit_id);
CREATE INDEX idx_unit_occupants_tenant_id ON unit_occupants(tenant_id);
