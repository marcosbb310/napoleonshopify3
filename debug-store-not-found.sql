-- Debug "Store not found" error for store: 7bd653c6-387e-48fd-bf41-8b50829c07a4
-- Run this in Supabase SQL Editor

-- Step 1: Check if store exists
SELECT 
  id,
  shop_domain,
  is_active,
  user_id,
  created_at
FROM stores
WHERE id = '7bd653c6-387e-48fd-bf41-8b50829c07a4';

-- Step 2: Check what user_id the store belongs to
SELECT 
  s.id as store_id,
  s.shop_domain,
  s.is_active as store_is_active,
  s.user_id as store_user_id,
  u.id as user_profile_id,
  u.auth_user_id,
  u.email
FROM stores s
LEFT JOIN users u ON s.user_id = u.id
WHERE s.id = '7bd653c6-387e-48fd-bf41-8b50829c07a4';

-- Step 3: Get your current auth user ID (check browser console or Supabase auth)
-- Then check if it matches:
-- Replace 'YOUR_AUTH_USER_ID' with your actual Supabase auth user ID
SELECT 
  u.id as user_profile_id,
  u.auth_user_id,
  u.email,
  s.id as store_id,
  s.shop_domain,
  s.is_active,
  CASE 
    WHEN s.id IS NULL THEN '❌ Store does not exist'
    WHEN s.is_active = false THEN '❌ Store is INACTIVE'
    WHEN s.user_id != u.id THEN '❌ Store belongs to different user'
    WHEN u.id IS NULL THEN '❌ User profile not found'
    ELSE '✅ Store is valid and should work'
  END as validation_status
FROM users u
LEFT JOIN stores s ON s.id = '7bd653c6-387e-48fd-bf41-8b50829c07a4'
WHERE u.auth_user_id = 'YOUR_AUTH_USER_ID_HERE';  -- Replace this!

-- Step 4: Check all conditions that requireStore() checks
-- This simulates the exact query requireStore() runs
SELECT 
  s.*,
  u.id as user_profile_id,
  u.auth_user_id,
  CASE 
    WHEN s.id IS NULL THEN 'Store not found'
    WHEN s.is_active = false THEN 'Store is inactive'
    WHEN s.user_id != u.id THEN 'Store does not belong to user'
    WHEN u.id IS NULL THEN 'User profile not found'
    ELSE 'All checks passed'
  END as check_result
FROM stores s
JOIN users u ON s.user_id = u.id
WHERE s.id = '7bd653c6-387e-48fd-bf41-8b50829c07a4'
  AND s.is_active = true
  AND u.auth_user_id = 'YOUR_AUTH_USER_ID_HERE';  -- Replace this!

-- Step 5: Quick fix - Check if store just needs to be activated
UPDATE stores
SET is_active = true,
    updated_at = NOW()
WHERE id = '7bd653c6-387e-48fd-bf41-8b50829c07a4'
  AND is_active = false;

-- Verify fix
SELECT id, shop_domain, is_active 
FROM stores 
WHERE id = '7bd653c6-387e-48fd-bf41-8b50829c07a4';

