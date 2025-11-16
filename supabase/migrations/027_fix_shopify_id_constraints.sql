-- Migration: Fix shopify_id constraints to prevent NULL values
-- This migration ensures shopify_id is always valid and non-null

-- Step 1: Clean existing invalid data
-- Convert empty strings, 'null', and 'undefined' strings to NULL
UPDATE products
SET shopify_id = NULL
WHERE shopify_id IN ('', 'undefined', 'null');

-- Step 2: Deactivate products with NULL shopify_id (don't delete, preserve for audit)
UPDATE products
SET is_active = false
WHERE shopify_id IS NULL;

-- Log how many products were affected
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM products
  WHERE shopify_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE NOTICE 'Deactivated % product(s) with NULL shopify_id', null_count;
  END IF;
END $$;

-- Step 3: Apply NOT NULL constraint
-- This will fail if there are still NULL values, which is expected
-- The deactivation above should have handled all NULLs, but this ensures no new NULLs
ALTER TABLE products 
ALTER COLUMN shopify_id SET NOT NULL;

-- Step 4: Add CHECK constraint to prevent empty strings
ALTER TABLE products
ADD CONSTRAINT shopify_id_nonempty 
CHECK (shopify_id IS NOT NULL AND shopify_id <> '');

-- Step 5: Verify constraint exists
DO $$
DECLARE
  is_nullable_value TEXT;
BEGIN
  SELECT is_nullable INTO is_nullable_value
  FROM information_schema.columns
  WHERE table_name = 'products' 
    AND column_name = 'shopify_id';
  
  IF is_nullable_value = 'NO' THEN
    RAISE NOTICE '✅ shopify_id constraint verified: NOT NULL enforced';
  ELSE
    RAISE WARNING '⚠️ shopify_id constraint verification failed: is_nullable = %', is_nullable_value;
  END IF;
END $$;

-- Verification query (run separately to check results)
-- SELECT 
--   COUNT(*) FILTER (WHERE shopify_id IS NULL) AS null_ids,
--   COUNT(*) FILTER (WHERE shopify_id = '') AS empty_ids,
--   COUNT(*) FILTER (WHERE shopify_id IN ('undefined','null')) AS invalid_string_ids,
--   COUNT(*) FILTER (WHERE is_active = true AND shopify_id IS NULL) AS active_null_ids
-- FROM products;

