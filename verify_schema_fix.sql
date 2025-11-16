-- Verification script to check if shopify_product_id column exists and has data
-- Run this in Supabase SQL Editor to verify the migration worked

-- 1. Check if column exists
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'product_variants' 
  AND column_name = 'shopify_product_id';

-- 2. Check variant count and how many have shopify_product_id
SELECT 
  COUNT(*) as total_variants,
  COUNT(shopify_product_id) as variants_with_shopify_product_id,
  COUNT(*) - COUNT(shopify_product_id) as variants_missing_shopify_product_id
FROM product_variants;

-- 3. Check sample variants to see their shopify_product_id values
SELECT 
  pv.id,
  pv.shopify_id as variant_shopify_id,
  pv.shopify_product_id,
  pv.store_id,
  p.id as product_db_id,
  p.shopify_id as product_shopify_id,
  p.store_id as product_store_id
FROM product_variants pv
LEFT JOIN products p ON pv.product_id = p.id
LIMIT 10;

-- 4. Find variants that are missing shopify_product_id
SELECT 
  pv.id,
  pv.shopify_id,
  pv.product_id,
  p.shopify_id as product_shopify_id,
  pv.store_id
FROM product_variants pv
LEFT JOIN products p ON pv.product_id = p.id
WHERE pv.shopify_product_id IS NULL
LIMIT 10;

