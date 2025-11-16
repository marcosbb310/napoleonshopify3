-- Fix missing shopify_product_id in variants
-- Run this if variants are missing shopify_product_id after migration

-- Step 1: Backfill shopify_product_id from parent product
UPDATE product_variants pv
SET shopify_product_id = p.shopify_id
FROM products p
WHERE pv.product_id = p.id
  AND pv.shopify_product_id IS NULL;

-- Step 2: Verify the backfill worked
SELECT 
  COUNT(*) as total_variants,
  COUNT(shopify_product_id) as variants_with_shopify_product_id,
  COUNT(*) - COUNT(shopify_product_id) as variants_still_missing
FROM product_variants;

-- Step 3: Show variants that are still missing (if any)
SELECT 
  pv.id,
  pv.shopify_id as variant_shopify_id,
  pv.product_id,
  p.shopify_id as product_shopify_id,
  pv.store_id
FROM product_variants pv
LEFT JOIN products p ON pv.product_id = p.id
WHERE pv.shopify_product_id IS NULL
LIMIT 20;

-- If variants_still_missing > 0, it means some variants don't have a parent product
-- This shouldn't happen, but if it does, those variants need to be fixed manually

