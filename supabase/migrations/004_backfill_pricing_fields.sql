-- Backfill pre_smart_pricing_price and last_smart_pricing_price for existing products
-- Run this after 002_add_toggle_fields.sql migration
-- Created: October 14, 2025

-- For products with smart pricing already enabled:
-- - Set pre_smart_pricing_price to starting_price (the original baseline)
-- - Set last_smart_pricing_price to current_price (where they are now)
UPDATE pricing_config pc
SET 
  pre_smart_pricing_price = COALESCE(pc.pre_smart_pricing_price, p.starting_price),
  last_smart_pricing_price = COALESCE(pc.last_smart_pricing_price, p.current_price)
FROM products p
WHERE pc.product_id = p.id
  AND pc.auto_pricing_enabled = true
  AND (pc.pre_smart_pricing_price IS NULL OR pc.last_smart_pricing_price IS NULL);

-- For products with smart pricing disabled:
-- - Set both fields to current_price (they're not in the cycle yet)
UPDATE pricing_config pc
SET 
  pre_smart_pricing_price = COALESCE(pc.pre_smart_pricing_price, p.current_price),
  last_smart_pricing_price = COALESCE(pc.last_smart_pricing_price, p.current_price)
FROM products p
WHERE pc.product_id = p.id
  AND pc.auto_pricing_enabled = false
  AND (pc.pre_smart_pricing_price IS NULL OR pc.last_smart_pricing_price IS NULL);

-- Verify the backfill
SELECT 
  COUNT(*) as total_configs,
  COUNT(CASE WHEN pre_smart_pricing_price IS NOT NULL THEN 1 END) as with_pre_smart,
  COUNT(CASE WHEN last_smart_pricing_price IS NOT NULL THEN 1 END) as with_last_smart,
  COUNT(CASE WHEN auto_pricing_enabled = true THEN 1 END) as enabled_count
FROM pricing_config;

