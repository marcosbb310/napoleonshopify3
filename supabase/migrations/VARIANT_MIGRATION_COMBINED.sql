-- COMBINED VARIANT-LEVEL PRICING MIGRATION
-- Run this entire file in Supabase Dashboard SQL Editor
-- This combines migrations 020, 021, 024 for variant-level pricing support

-- ============================================================================
-- MIGRATION 020: Add store_id to product_variants
-- ============================================================================

BEGIN;

-- Add store_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'product_variants' 
    AND column_name = 'store_id'
  ) THEN
    ALTER TABLE public.product_variants ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;
    
    -- Backfill store_id from parent product
    UPDATE public.product_variants pv
    SET store_id = p.store_id
    FROM public.products p
    WHERE pv.product_id = p.id
      AND pv.store_id IS NULL;
    
    -- Make store_id NOT NULL after backfill
    ALTER TABLE public.product_variants ALTER COLUMN store_id SET NOT NULL;
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_product_variants_store_id ON public.product_variants(store_id);
    
    -- Add composite unique constraint for store_id + product_id + shopify_id
    ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_shopify_id_key;
    ALTER TABLE public.product_variants 
      ADD CONSTRAINT product_variants_store_product_shopify_unique 
      UNIQUE (store_id, product_id, shopify_id);
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION 021: Core variant-level pricing schema
-- ============================================================================

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

-- ============================================================================
-- MIGRATION 024: Add variant_id to history and sales
-- ============================================================================

BEGIN;

-- Add variant_id to sales_data
ALTER TABLE sales_data
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;

-- Create index for variant-specific sales queries
CREATE INDEX IF NOT EXISTS idx_sales_data_variant_id ON sales_data(variant_id);

-- Add variant_id to pricing_history
ALTER TABLE pricing_history
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;

-- Create index for variant-specific history queries
CREATE INDEX IF NOT EXISTS idx_pricing_history_variant_id ON pricing_history(variant_id);

-- Make product_id nullable in pricing_history for backward compatibility
-- (variants will have both variant_id and product_id)
ALTER TABLE pricing_history
  ALTER COLUMN product_id DROP NOT NULL;

-- Add comments
COMMENT ON COLUMN sales_data.variant_id IS 'Links sales data to a specific variant for variant-level analytics';
COMMENT ON COLUMN pricing_history.variant_id IS 'Links pricing history to a specific variant for variant-level tracking';

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT '✅ All variant-level pricing migrations completed successfully!' as status;

