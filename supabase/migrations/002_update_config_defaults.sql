-- Update existing pricing_config records to new defaults
UPDATE pricing_config
SET 
  revenue_drop_threshold = 1.0,
  wait_days_after_revert = 2
WHERE 
  revenue_drop_threshold = 5.0
  AND wait_days_after_revert = 5;

