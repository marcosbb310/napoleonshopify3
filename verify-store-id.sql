-- Verify Store ID: 7bd653c6-387e-48fd-bf41-8b50829c07a4
-- Run this in Supabase SQL Editor

-- 1. Check if store exists
SELECT 
  id,
  shop_domain,
  is_active,
  user_id,
  created_at,
  updated_at
FROM stores
WHERE id = '7bd653c6-387e-48fd-bf41-8b50829c07a4';

-- 2. If store exists, check if it belongs to your user
-- (Replace YOUR_AUTH_USER_ID with your actual auth user ID)
SELECT 
  s.id as store_id,
  s.shop_domain,
  s.is_active,
  s.user_id,
  u.id as user_profile_id,
  u.auth_user_id,
  CASE 
    WHEN s.is_active = true THEN '✅ Active'
    ELSE '❌ Inactive'
  END as status
FROM stores s
LEFT JOIN users u ON s.user_id = u.id
WHERE s.id = '7bd653c6-387e-48fd-bf41-8b50829c07a4';

-- 3. Check all conditions for sync to work
SELECT 
  s.id as store_id,
  s.shop_domain,
  s.is_active as store_is_active,
  s.user_id,
  u.id as user_profile_id,
  u.auth_user_id,
  CASE 
    WHEN s.id IS NULL THEN '❌ Store does not exist'
    WHEN s.is_active = false THEN '❌ Store is inactive'
    WHEN u.id IS NULL THEN '❌ User profile not found'
    WHEN s.user_id != u.id THEN '❌ Store does not belong to user'
    ELSE '✅ Store is valid and ready for sync'
  END as validation_status
FROM stores s
LEFT JOIN users u ON s.user_id = u.id
WHERE s.id = '7bd653c6-387e-48fd-bf41-8b50829c07a4';

