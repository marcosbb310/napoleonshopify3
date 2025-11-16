-- Find the correct store ID for "revenue test store"
-- Run this in Supabase SQL Editor

-- 1. List all stores to find the revenue test store
SELECT 
  id as store_id,
  shop_domain,
  is_active,
  user_id,
  created_at,
  updated_at
FROM stores
ORDER BY created_at DESC;

-- 2. Search for stores with "revenue" in the domain
SELECT 
  id as store_id,
  shop_domain,
  is_active,
  user_id,
  created_at
FROM stores
WHERE shop_domain ILIKE '%revenue%'
ORDER BY created_at DESC;

-- 3. Check which store is currently being used (check products table)
SELECT 
  s.id as store_id,
  s.shop_domain,
  s.is_active,
  COUNT(p.id) as product_count,
  MAX(p.updated_at) as last_product_update
FROM stores s
LEFT JOIN products p ON s.id = p.store_id
GROUP BY s.id, s.shop_domain, s.is_active
ORDER BY last_product_update DESC NULLS LAST;

-- 4. Find the store with the most recent activity
SELECT 
  s.id as store_id,
  s.shop_domain,
  s.is_active,
  s.last_synced_at,
  COUNT(p.id) as product_count
FROM stores s
LEFT JOIN products p ON s.id = p.store_id
WHERE s.is_active = true
GROUP BY s.id, s.shop_domain, s.is_active, s.last_synced_at
ORDER BY s.last_synced_at DESC NULLS LAST, product_count DESC;

