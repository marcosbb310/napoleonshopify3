-- Check if products exist in database and have dbId (UUID)
-- Run this in Supabase SQL Editor to verify products are synced

-- 1. Check total products in database
SELECT 
  COUNT(*) as total_products_in_db,
  COUNT(DISTINCT store_id) as stores_with_products
FROM products;

-- 2. Check products for a specific store (replace with your store_id)
-- Get your store_id from browser console: localStorage.getItem('selected-store-id')
SELECT 
  id as dbId,  -- This IS the dbId (UUID)
  shopify_id,  -- Shopify ID (string)
  title,
  store_id,
  created_at,
  updated_at
FROM products
WHERE store_id = 'YOUR_STORE_ID_HERE'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if products have matching shopify_ids
-- This verifies the lookup will work
SELECT 
  p.id as dbId,
  p.shopify_id,
  p.title,
  p.store_id,
  CASE 
    WHEN p.shopify_id IS NOT NULL AND p.id IS NOT NULL THEN '✅ Has both'
    WHEN p.shopify_id IS NULL THEN '❌ Missing shopify_id'
    WHEN p.id IS NULL THEN '❌ Missing id (dbId)'
    ELSE '⚠️ Unknown issue'
  END as status
FROM products p
WHERE p.store_id = 'YOUR_STORE_ID_HERE'
LIMIT 20;

-- 4. Count products without proper IDs
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE shopify_id IS NULL) as missing_shopify_id,
  COUNT(*) FILTER (WHERE id IS NULL) as missing_id
FROM products
WHERE store_id = 'YOUR_STORE_ID_HERE';

-- 5. Test the lookup query (same as API does)
-- Replace 'YOUR_SHOPIFY_ID_HERE' with actual Shopify ID from products
SELECT 
  id as dbId,
  shopify_id,
  title
FROM products
WHERE store_id = 'YOUR_STORE_ID_HERE'
  AND shopify_id IN ('YOUR_SHOPIFY_ID_HERE', 'ANOTHER_SHOPIFY_ID')
LIMIT 10;

