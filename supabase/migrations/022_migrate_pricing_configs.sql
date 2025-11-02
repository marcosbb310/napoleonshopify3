-- Migrate existing product-level pricing_configs to variant-level
-- This ensures existing configurations are preserved during the migration

BEGIN;

-- Create temporary mapping of products to their default variant
CREATE TEMP TABLE product_default_variants AS
SELECT 
  p.id as product_id,
  p.store_id,
  pv.id as variant_id,
  ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY pv.created_at ASC) as variant_rank
FROM products p
JOIN product_variants pv ON p.id = pv.product_id
WHERE p.id IN (SELECT DISTINCT product_id FROM pricing_config WHERE product_id IS NOT NULL);

-- Migrate pricing_config to first variant of each product
INSERT INTO pricing_config (
  variant_id,
  auto_pricing_enabled,
  increment_percentage,
  period_hours,
  revenue_drop_threshold,
  wait_hours_after_revert,
  max_increase_percentage,
  current_state,
  last_price_change_date,
  revert_wait_until_date,
  pre_smart_pricing_price,
  last_smart_pricing_price,
  next_price_change_date,
  created_at,
  updated_at
)
SELECT 
  pdv.variant_id,
  pc.auto_pricing_enabled,
  pc.increment_percentage,
  pc.period_hours,
  pc.revenue_drop_threshold,
  pc.wait_hours_after_revert,
  pc.max_increase_percentage,
  pc.current_state,
  pc.last_price_change_date,
  pc.revert_wait_until_date,
  pc.pre_smart_pricing_price,
  pc.last_smart_pricing_price,
  pc.next_price_change_date,
  pc.created_at,
  pc.updated_at
FROM pricing_config pc
JOIN product_default_variants pdv ON pc.product_id = pdv.product_id
WHERE pdv.variant_rank = 1  -- Only migrate to first variant
  AND pc.variant_id IS NULL  -- Only migrate configs not already migrated
  AND pc.product_id IS NOT NULL;

-- Copy product current_price to variant current_price if missing
UPDATE product_variants pv
SET current_price = p.current_price
FROM products p
WHERE pv.product_id = p.id
  AND pv.current_price IS NULL
  AND p.current_price IS NOT NULL;

-- Drop old product_id based configs (after verifying migration worked)
-- WARNING: Comment this out initially, uncomment after manual verification
-- DELETE FROM pricing_config WHERE variant_id IS NULL AND product_id IS NOT NULL;

COMMIT;

