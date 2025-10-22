-- Run this in Supabase Dashboard → SQL Editor to check if store is linked to user

-- 1. Check authenticated users
SELECT 
  'AUTH USERS' as table_name,
  id, 
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Check public users table
SELECT 
  'PUBLIC USERS' as table_name,
  id,
  auth_user_id,
  email,
  name,
  created_at
FROM users
ORDER BY created_at DESC;

-- 3. Check stores
SELECT 
  'STORES' as table_name,
  id,
  user_id,
  shop_domain,
  access_token IS NOT NULL as has_token,
  is_active,
  installed_at
FROM stores
ORDER BY installed_at DESC;

-- 4. Check the link (most important)
SELECT 
  'USER-STORE LINK' as info,
  u.email as user_email,
  u.auth_user_id as user_auth_id,
  s.id as store_id,
  s.shop_domain,
  s.access_token IS NOT NULL as has_access_token,
  s.is_active as store_active
FROM users u
LEFT JOIN stores s ON s.user_id = u.id
WHERE u.auth_user_id IS NOT NULL
ORDER BY u.created_at DESC;

