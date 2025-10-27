-- Add wait_hours_after_revert column (or rename if old column exists)
-- Change unit from days to hours (matches period_hours)
-- Created: October 14, 2025

-- Check if old column exists, if so rename it, otherwise add new column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pricing_config' 
    AND column_name = 'wait_days_after_revert'
  ) THEN
    -- Old column exists, rename it
    ALTER TABLE pricing_config 
      RENAME COLUMN wait_days_after_revert TO wait_hours_after_revert;
    
    -- Convert existing values from days to hours (multiply by 24)
    UPDATE pricing_config
    SET wait_hours_after_revert = wait_hours_after_revert * 24;
    
    RAISE NOTICE 'Renamed wait_days_after_revert to wait_hours_after_revert and converted values';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pricing_config' 
    AND column_name = 'wait_hours_after_revert'
  ) THEN
    -- Neither column exists, add the new one
    ALTER TABLE pricing_config 
      ADD COLUMN wait_hours_after_revert INTEGER DEFAULT 24;
    
    RAISE NOTICE 'Added new column wait_hours_after_revert with default 24 hours';
  ELSE
    RAISE NOTICE 'Column wait_hours_after_revert already exists, skipping';
  END IF;
END $$;

-- Ensure default is set to 24 hours (matches period_hours)
ALTER TABLE pricing_config 
  ALTER COLUMN wait_hours_after_revert SET DEFAULT 24;

-- Add helpful comment
COMMENT ON COLUMN pricing_config.wait_hours_after_revert IS 'Number of hours to wait after reverting price before trying to increase again (default: 24 hours, matches period_hours)';

-- Verify the changes
SELECT 
  COUNT(*) as total_configs,
  COALESCE(AVG(wait_hours_after_revert), 0) as avg_wait_hours,
  COALESCE(MIN(wait_hours_after_revert), 0) as min_wait_hours,
  COALESCE(MAX(wait_hours_after_revert), 0) as max_wait_hours
FROM pricing_config;

