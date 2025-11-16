-- Fix Store Issues for: 7bd653c6-387e-48fd-bf41-8b50829c07a4
-- Run this in Supabase SQL Editor

-- Step 1: Check if there's a revenue test store that's already active
SELECT 
  id,
  shop_domain,
  is_active,
  user_id,
  created_at
FROM stores
WHERE shop_domain ILIKE '%revenue%'
ORDER BY created_at DESC;

-- Step 2: Check all your stores to see which one you should use
SELECT 
  s.id,
  s.shop_domain,
  s.is_active,
  s.user_id,
  u.id as user_profile_id,
  u.auth_user_id,
  CASE 
    WHEN s.user_id = 'af37bd93-c6f6-477e-8a2e-626364cda03a' AND s.is_active = true THEN '✅ CORRECT - Use this one!'
    WHEN s.user_id = 'af37bd93-c6f6-477e-8a2e-626364cda03a' AND s.is_active = false THEN '⚠️ Your store but INACTIVE'
    WHEN s.user_id != 'af37bd93-c6f6-477e-8a2e-626364cda03a' THEN '❌ Belongs to different user'
    ELSE '❓ Unknown issue'
  END as status
FROM stores s
LEFT JOIN users u ON s.user_id = u.id
ORDER BY s.created_at DESC;

-- Step 3: OPTION A - Activate and transfer store to your user
-- (Only do this if you want to use the napolen-test-store)
UPDATE stores
SET 
  is_active = true,
  user_id = 'af37bd93-c6f6-477e-8a2e-626364cda03a',  -- Your user profile ID
  updated_at = NOW()
WHERE id = '7bd653c6-387e-48fd-bf41-8b50829c07a4';

-- Step 4: Verify the fix
SELECT 
  id,
  shop_domain,
  is_active,
  user_id,
  CASE 
    WHEN is_active = true AND user_id = 'af37bd93-c6f6-477e-8a2e-626364cda03a' THEN '✅ FIXED - Ready to use!'
    WHEN is_active = false THEN '❌ Still inactive'
    WHEN user_id != 'af37bd93-c6f6-477e-8a2e-626364cda03a' THEN '❌ Still belongs to different user'
    ELSE '❓ Check manually'
  END as status
FROM stores
WHERE id = '7bd653c6-387e-48fd-bf41-8b50829c07a4';

-- Step 5: (Alternative) If you have a revenue test store, find and activate it instead
-- First, find revenue test store:
SELECT 
  id,
  shop_domain,
  is_active,
  user_id
FROM stores
WHERE shop_domain ILIKE '%revenue%';

-- Then activate it and make sure it belongs to you:
-- UPDATE stores
-- SET 
--   is_active = true,
--   user_id = 'af37bd93-c6f6-477e-8a2e-626364cda03a',
--   updated_at = NOW()
-- WHERE shop_domain ILIKE '%revenue%'
--   AND id = 'REVENUE_STORE_ID_HERE';  -- Replace with actual ID

