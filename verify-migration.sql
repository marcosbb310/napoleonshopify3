-- Verification queries for migration 027_fix_shopify_id_constraints.sql
-- Run these in Supabase SQL Editor to verify the migration was successful

-- 1. Check if shopify_id has NOT NULL constraint
SELECT 
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'products' 
  AND column_name = 'shopify_id';
-- Expected: is_nullable = 'NO'

-- 2. Check if CHECK constraint exists
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'products' 
  AND constraint_name = 'shopify_id_nonempty';
-- Expected: Should return 1 row

-- 3. Count any remaining invalid shopify_id values
SELECT 
  COUNT(*) FILTER (WHERE shopify_id IS NULL) AS null_ids,
  COUNT(*) FILTER (WHERE shopify_id = '') AS empty_ids,
  COUNT(*) FILTER (WHERE shopify_id IN ('undefined','null')) AS invalid_string_ids,
  COUNT(*) FILTER (WHERE is_active = true AND shopify_id IS NULL) AS active_null_ids,
  COUNT(*) AS total_products
FROM products;
-- Expected: All counts should be 0 (except total_products)

-- 4. Check deactivated products (if any were found with NULL shopify_id)
SELECT 
  COUNT(*) AS deactivated_products
FROM products
WHERE is_active = false AND shopify_id IS NULL;
-- This shows how many products were deactivated by the migration

