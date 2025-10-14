-- Update existing products to 24-hour cycle (1 day)
-- Run this in Supabase SQL Editor

-- Update all existing products to 24 hours
UPDATE pricing_config SET period_hours = 24;

-- Update the default for future products
ALTER TABLE pricing_config ALTER COLUMN period_hours SET DEFAULT 24;

-- Verify the change
SELECT 
  'Updated to 24-hour cycle!' as status,
  COUNT(*) as total_products,
  period_hours
FROM pricing_config
GROUP BY period_hours;

