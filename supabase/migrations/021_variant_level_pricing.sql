-- Migrate pricing configuration from product-level to variant-level
-- This allows each variant to have independent smart pricing

BEGIN;

-- 1. Add variant_id to pricing_config
ALTER TABLE pricing_config
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_pricing_config_variant_id ON pricing_config(variant_id);

-- 2. Make product_id nullable (for backward compatibility during transition)
ALTER TABLE pricing_config
  ALTER COLUMN product_id DROP NOT NULL;

-- 3. Add starting_price and current_price to product_variants
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS starting_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS current_price DECIMAL(10, 2);

-- 4. Backfill starting_price from price column (current Shopify price)
UPDATE product_variants
SET starting_price = price::DECIMAL(10, 2),
    current_price = price::DECIMAL(10, 2)
WHERE starting_price IS NULL OR current_price IS NULL;

-- 5. Make prices NOT NULL after backfill
ALTER TABLE product_variants
  ALTER COLUMN starting_price SET NOT NULL,
  ALTER COLUMN current_price SET NOT NULL;

-- 6. Add comments for documentation
COMMENT ON COLUMN pricing_config.variant_id IS 'Links pricing config to a specific variant. Each variant has independent smart pricing.';
COMMENT ON COLUMN product_variants.starting_price IS 'Price from Shopify when variant was first synced (baseline for reverting)';
COMMENT ON COLUMN product_variants.current_price IS 'Current price of variant (may be different from starting_price due to smart pricing)';

-- 7. Update unique constraint on pricing_config
-- Drop old constraint if exists
ALTER TABLE pricing_config DROP CONSTRAINT IF EXISTS pricing_config_product_id_key;
-- Add new constraint for variant_id (can only have one config per variant)
ALTER TABLE pricing_config 
  ADD CONSTRAINT pricing_config_variant_unique UNIQUE (variant_id);

COMMIT;

