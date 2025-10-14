-- Add smart pricing toggle fields to pricing_config table
-- This migration adds fields needed for smart pricing on/off functionality
-- Created: October 14, 2025

-- Add new columns to pricing_config
ALTER TABLE pricing_config 
  ADD COLUMN pre_smart_pricing_price DECIMAL(10, 2),
  ADD COLUMN last_smart_pricing_price DECIMAL(10, 2);

-- Add helpful comments
COMMENT ON COLUMN pricing_config.pre_smart_pricing_price IS 'Price captured when smart pricing is first enabled (baseline for reverting)';
COMMENT ON COLUMN pricing_config.last_smart_pricing_price IS 'Price stored when smart pricing is disabled (for resume option)';

-- Backfill existing products with smart pricing enabled
-- Set pre_smart_pricing_price to starting_price for products that already have smart pricing on
UPDATE pricing_config pc
SET 
  pre_smart_pricing_price = p.starting_price,
  last_smart_pricing_price = p.current_price
FROM products p
WHERE pc.product_id = p.id
  AND pc.auto_pricing_enabled = true
  AND pc.pre_smart_pricing_price IS NULL;

