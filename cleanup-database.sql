-- Clean up stores and products (OPTIONAL - only run if you want to start fresh)
-- Run this in Supabase SQL Editor if you want to clean up

-- 1. Delete all products (will cascade delete variants)
DELETE FROM public.products;

-- 2. Delete all stores (will cascade delete related data)
DELETE FROM public.stores;

-- 3. Delete OAuth sessions
DELETE FROM public.oauth_sessions;

-- 4. Delete sync status
DELETE FROM public.sync_status;

-- 5. Verify cleanup
SELECT COUNT(*) as remaining_products FROM public.products;
SELECT COUNT(*) as remaining_stores FROM public.stores;
