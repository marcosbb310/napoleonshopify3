-- Add next_price_change_date field to pricing_config table

ALTER TABLE pricing_config
ADD COLUMN next_price_change_date TIMESTAMPTZ;

-- Calculate and set next_price_change_date for existing products
UPDATE pricing_config
SET next_price_change_date = 
  CASE 
    WHEN last_price_change_date IS NOT NULL 
    THEN last_price_change_date + (period_days || ' days')::INTERVAL
    ELSE NOW() + (period_days || ' days')::INTERVAL
  END;

-- Add comment for documentation
COMMENT ON COLUMN pricing_config.next_price_change_date IS 'Timestamp when the next price change should occur. Updated after each price change and when user manually changes price.';

