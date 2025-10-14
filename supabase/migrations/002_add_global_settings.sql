-- Add global settings table for system-wide configurations
-- Last updated: October 14, 2025

-- Create global settings table
CREATE TABLE IF NOT EXISTS global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add trigger for updated_at
CREATE TRIGGER update_global_settings_updated_at BEFORE UPDATE ON global_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for MVP (enable before production)
ALTER TABLE global_settings DISABLE ROW LEVEL SECURITY;

-- Insert default global smart pricing setting
INSERT INTO global_settings (key, value, description)
VALUES (
  'smart_pricing_global_enabled',
  'true'::jsonb,
  'Global toggle for smart pricing system. When disabled, no automated price changes will occur.'
)
ON CONFLICT (key) DO NOTHING;

-- Add helpful comment
COMMENT ON TABLE global_settings IS 'System-wide configuration settings. Use key-value pairs with JSONB for flexibility.';

