-- Add variant_id to sales_data and pricing_history tables for variant-level tracking

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

