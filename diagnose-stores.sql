-- Diagnostic Query: Check Store and Product Setup
-- Run this in Supabase SQL Editor to see what's linked where

-- 1. Check all stores in database
SELECT 
    id,
    shop_domain,
    user_id,
    is_active,
    installed_at,
    updated_at,
    CASE 
        WHEN access_token IS NOT NULL THEN 'Has plain token'
        WHEN access_token_encrypted IS NOT NULL THEN 'Has encrypted token'
        ELSE 'No token'
    END as token_status
FROM public.stores
ORDER BY installed_at DESC;

-- 2. Check products by store
SELECT 
    s.shop_domain,
    COUNT(p.id) as product_count,
    COUNT(pv.id) as variant_count,
    MIN(p.created_at) as first_product_added,
    MAX(p.updated_at) as last_product_updated
FROM public.stores s
LEFT JOIN public.products p ON p.store_id = s.id
LEFT JOIN public.product_variants pv ON pv.product_id = p.id
GROUP BY s.id, s.shop_domain
ORDER BY s.shop_domain;

-- 3. Check which store has the most products
SELECT 
    s.shop_domain,
    COUNT(DISTINCT p.id) as product_count,
    COUNT(DISTINCT pv.id) as variant_count,
    STRING_AGG(DISTINCT p.title, ', ') FILTER (WHERE p.title IS NOT NULL) as sample_products
FROM public.stores s
LEFT JOIN public.products p ON p.store_id = s.id
LEFT JOIN public.product_variants pv ON pv.product_id = p.id
GROUP BY s.id, s.shop_domain
ORDER BY product_count DESC;

-- 4. Check for orphaned products (products without a store)
SELECT 
    COUNT(*) as orphaned_products,
    STRING_AGG(title, ', ') as product_titles
FROM public.products
WHERE store_id IS NULL;

-- 5. Check for products with wrong store_id (if any)
SELECT 
    p.id,
    p.title,
    p.shopify_id,
    p.store_id,
    s.shop_domain,
    CASE 
        WHEN s.id IS NULL THEN 'Store not found!'
        ELSE 'OK'
    END as store_status
FROM public.products p
LEFT JOIN public.stores s ON s.id = p.store_id
WHERE p.store_id IS NOT NULL
ORDER BY p.created_at DESC
LIMIT 20;
