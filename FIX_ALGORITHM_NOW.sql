-- COMPLETE FIX FOR PRICING ALGORITHM
-- Run this in Supabase SQL Editor to fix everything
-- Date: October 15, 2025

-- ==================================================
-- FIX 1: Create global_settings table (if missing)
-- ==================================================
CREATE TABLE IF NOT EXISTS global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS for MVP
ALTER TABLE global_settings DISABLE ROW LEVEL SECURITY;

-- ==================================================
-- FIX 2: Enable global smart pricing
-- ==================================================
INSERT INTO global_settings (key, value, description)
VALUES ('smart_pricing_global_enabled', 'true'::jsonb, 'Global toggle for smart pricing')
ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb;

-- ==================================================
-- FIX 3: Add next_price_change_date column (if missing)
-- ==================================================
ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS next_price_change_date TIMESTAMPTZ;

-- ==================================================
-- FIX 4: Backfill next_price_change_date to NOW()
-- So algorithm runs immediately for all products
-- ==================================================
UPDATE pricing_config 
SET next_price_change_date = NOW() 
WHERE next_price_change_date IS NULL;

-- ==================================================
-- VERIFICATION: Check if fixes worked
-- ==================================================
SELECT 
  'Global Settings' as check_type,
  key,
  value,
  'Should be true' as expected
FROM global_settings
WHERE key = 'smart_pricing_global_enabled'

UNION ALL

SELECT 
  'Pricing Config' as check_type,
  product_id::text as key,
  to_jsonb(next_price_change_date) as value,
  'Should not be null' as expected
FROM pricing_config
LIMIT 3;

-- ==================================================
-- EXPECTED OUTPUT:
-- Row 1: smart_pricing_global_enabled = true
-- Rows 2-4: Products with next_price_change_date populated
-- ==================================================

