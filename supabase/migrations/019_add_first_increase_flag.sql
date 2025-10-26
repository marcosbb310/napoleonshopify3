-- Add is_first_increase flag to pricing_config
ALTER TABLE pricing_config 
  ADD COLUMN IF NOT EXISTS is_first_increase BOOLEAN DEFAULT TRUE;

-- Backfill existing products to false (they've already had increases)
UPDATE pricing_config 
SET is_first_increase = FALSE 
WHERE last_price_change_date IS NOT NULL;

-- Add comment
COMMENT ON COLUMN pricing_config.is_first_increase IS 
  'True if product has never had a price increase. First increase happens immediately without revenue check.';
