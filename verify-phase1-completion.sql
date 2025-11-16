-- Phase 1 Completion Verification Script
-- Run this in Supabase SQL Editor to verify Phase 1 is complete

-- ============================================================================
-- 4.1 VERIFY DATABASE UNIQUE CONSTRAINT EXISTS
-- ============================================================================
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'products'::regclass
  AND contype = 'u'
  AND pg_get_constraintdef(oid) LIKE '%shopify_id%';

-- Expected: Should return at least one row with constraint containing 'store_id' and 'shopify_id'
-- If no rows returned, run the constraint creation in 029_phase1_data_integrity_verification.sql

-- ============================================================================
-- 4.2 VERIFY NO DUPLICATE shopify_ids (Within Same Store)
-- ============================================================================
SELECT 
  store_id,
  shopify_id,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY updated_at DESC) as product_ids,
  array_agg(title ORDER BY updated_at DESC) as titles
FROM products
WHERE shopify_id IS NOT NULL
  AND is_active = true
GROUP BY store_id, shopify_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, store_id;

-- Expected: Should return 0 rows (no duplicates)
-- If rows returned, run cleanup queries from 029_phase1_data_integrity_verification.sql

-- ============================================================================
-- 4.3 VERIFY NO PRODUCTS WITH NULL shopify_id
-- ============================================================================
SELECT 
  id,
  store_id,
  title,
  shopify_id,
  created_at,
  updated_at,
  is_active
FROM products
WHERE shopify_id IS NULL
  AND is_active = true
ORDER BY updated_at DESC;

-- Expected: Should return 0 rows (all active products have shopify_id)
-- If rows returned, deactivate them using query from 029_phase1_data_integrity_verification.sql

-- ============================================================================
-- SUMMARY CHECK
-- ============================================================================
SELECT 
  (SELECT COUNT(*) FROM products WHERE is_active = true) as total_active_products,
  (SELECT COUNT(*) FROM products WHERE shopify_id IS NOT NULL AND is_active = true) as products_with_shopify_id,
  (SELECT COUNT(*) FROM products WHERE shopify_id IS NULL AND is_active = true) as products_with_null_shopify_id,
  (SELECT COUNT(*) FROM (
    SELECT store_id, shopify_id, COUNT(*) 
    FROM products 
    WHERE shopify_id IS NOT NULL AND is_active = true 
    GROUP BY store_id, shopify_id 
    HAVING COUNT(*) > 1
  ) duplicates) as duplicate_groups,
  (SELECT COUNT(*) FROM pg_constraint 
   WHERE conrelid = 'products'::regclass 
   AND contype = 'u' 
   AND pg_get_constraintdef(oid) LIKE '%shopify_id%') as unique_constraints_count;

-- Expected Results:
-- ✅ total_active_products > 0
-- ✅ products_with_shopify_id = total_active_products (100% have shopify_id)
-- ✅ products_with_null_shopify_id = 0
-- ✅ duplicate_groups = 0
-- ✅ unique_constraints_count >= 1

