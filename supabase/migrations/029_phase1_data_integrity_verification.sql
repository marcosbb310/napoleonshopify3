-- Phase 1: Data Integrity Verification and Cleanup
-- Run these queries in Supabase SQL Editor to verify and fix data integrity issues

-- ============================================================================
-- 4.1 VERIFY DATABASE UNIQUE CONSTRAINT
-- ============================================================================
-- Check if composite unique constraint exists on (store_id, shopify_id)
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'products'::regclass
  AND contype = 'u'
  AND pg_get_constraintdef(oid) LIKE '%shopify_id%';

-- If constraint is missing, create it:
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'products'::regclass 
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%store_id%shopify_id%'
  ) THEN
    ALTER TABLE products 
    ADD CONSTRAINT products_store_shopify_unique 
    UNIQUE (store_id, shopify_id);
    RAISE NOTICE '✅ Created unique constraint on (store_id, shopify_id)';
  ELSE
    RAISE NOTICE '✅ Unique constraint already exists';
  END IF;
END $$;

-- ============================================================================
-- 4.2 FIND DUPLICATE shopify_ids (Within Same Store)
-- ============================================================================
-- Find products with duplicate shopify_ids within the same store
SELECT 
  store_id,
  shopify_id,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY updated_at DESC) as product_ids,
  array_agg(title ORDER BY updated_at DESC) as titles,
  array_agg(updated_at ORDER BY updated_at DESC) as update_times
FROM products
WHERE shopify_id IS NOT NULL
  AND is_active = true
GROUP BY store_id, shopify_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, store_id;

-- Expected Result: Should return 0 rows (no duplicates)
-- If duplicates found: Note the duplicate_count, product_ids, titles, and update_times for cleanup

-- ============================================================================
-- 4.3 FIND PRODUCTS WITH NULL shopify_id
-- ============================================================================
-- Find products with missing shopify_id (will cause React key errors)
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

-- Expected Result: Should return 0 rows (all products have shopify_id)
-- If NULL found: Note the product IDs and titles - these need to be either fixed or deactivated

-- ============================================================================
-- 4.4 CLEAN UP DUPLICATE PRODUCTS (IF FOUND)
-- ============================================================================
-- IMPORTANT: BACKUP FIRST - Export duplicate products before deletion

-- Step 1: Create backup table
CREATE TABLE IF NOT EXISTS products_duplicates_backup AS
SELECT * FROM products
WHERE id IN (
  SELECT unnest(product_ids[2:]) -- All except first (newest)
  FROM (
    SELECT 
      store_id,
      shopify_id,
      array_agg(id ORDER BY updated_at DESC) as product_ids
    FROM products
    WHERE shopify_id IS NOT NULL
      AND is_active = true
    GROUP BY store_id, shopify_id
    HAVING COUNT(*) > 1
  ) duplicates
);

-- Step 2: Verify backup was created
SELECT COUNT(*) as backup_count FROM products_duplicates_backup;

-- Step 3: Delete duplicate products, keeping only the most recently updated version
-- CRITICAL: Only run after backup is confirmed
-- Uncomment the following block to execute cleanup:
/*
WITH duplicates AS (
  SELECT 
    store_id,
    shopify_id,
    array_agg(id ORDER BY updated_at DESC) as product_ids
  FROM products
  WHERE shopify_id IS NOT NULL
    AND is_active = true
  GROUP BY store_id, shopify_id
  HAVING COUNT(*) > 1
)
DELETE FROM products
WHERE id IN (
  SELECT unnest(product_ids[2:]) -- Delete all except first (newest)
  FROM duplicates
)
AND id IN (
  SELECT id FROM products_duplicates_backup -- Only delete backed up records
);

-- Step 4: Verify cleanup
-- Re-run duplicate check (4.2) - should return 0 rows
*/

-- ============================================================================
-- 4.5 HANDLE PRODUCTS WITH NULL shopify_id (IF FOUND)
-- ============================================================================
-- Option A - Deactivate (Recommended if can't be fixed)
-- Uncomment to execute:
/*
UPDATE products
SET is_active = false,
    updated_at = NOW()
WHERE shopify_id IS NULL
  AND is_active = true;

-- Verify: Re-run NULL check (4.3) - should return 0 active rows
*/

-- Option B - Manual Fix (Only if you have source data)
-- If products came from Shopify sync, they should have shopify_id
-- If NULL shopify_id products are orphaned/invalid, deactivate them
-- Manual Fix: Update shopify_id if you have the correct Shopify product ID
-- Example:
-- UPDATE products SET shopify_id = 'correct-id' WHERE id = 'product-uuid';

-- ============================================================================
-- VERIFICATION QUERIES (Run after cleanup)
-- ============================================================================

-- Verify no duplicates remain
SELECT 
  store_id,
  shopify_id,
  COUNT(*) as count
FROM products
WHERE shopify_id IS NOT NULL
  AND is_active = true
GROUP BY store_id, shopify_id
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Verify no active products with NULL shopify_id
SELECT COUNT(*) as null_count
FROM products
WHERE shopify_id IS NULL
  AND is_active = true;
-- Should return 0

-- Summary
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
  ) duplicates) as duplicate_groups;

