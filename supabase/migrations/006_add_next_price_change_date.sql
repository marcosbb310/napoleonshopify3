-- Add missing next_price_change_date column to pricing_config
-- This field is critical for the algorithm to know when to process each product
-- Created: October 15, 2025

-- Add the missing column
ALTER TABLE pricing_config 
  ADD COLUMN IF NOT EXISTS next_price_change_date TIMESTAMPTZ;

-- Backfill with appropriate dates:
-- - If last_price_change_date exists, calculate next change based on period_hours
-- - Otherwise, set to NOW() so algorithm can run immediately
UPDATE pricing_config
SET next_price_change_date = CASE
  WHEN last_price_change_date IS NOT NULL 
    THEN last_price_change_date + (period_hours || ' hours')::INTERVAL
  ELSE NOW()
END
WHERE next_price_change_date IS NULL;

-- Add helpful comment
COMMENT ON COLUMN pricing_config.next_price_change_date IS 'Timestamp when the next price change should occur. Updated after each price change and manual overrides.';

-- Verify the update
SELECT 
  product_id,
  last_price_change_date,
  next_price_change_date,
  period_hours,
  auto_pricing_enabled
FROM pricing_config
ORDER BY next_price_change_date;

