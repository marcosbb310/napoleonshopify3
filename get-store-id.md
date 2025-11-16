# How to Find Your Store ID

## Quick Methods

### 1. Browser Console (Fastest)
```javascript
// In browser console (F12):
localStorage.getItem('selected-store-id')
```

### 2. Check Network Request
1. Open DevTools (F12) → Network tab
2. Click "Sync Products" button
3. Find `/api/shopify/sync` request
4. Check Request Payload → `storeId` field

### 3. Database Query (Supabase SQL Editor)
```sql
-- Get all your stores
SELECT 
  id as store_id,
  shop_domain,
  is_active,
  user_id,
  created_at
FROM stores
WHERE is_active = true
ORDER BY created_at DESC;
```

### 4. Check Server Logs
When you try to sync, the server logs will show:
```
🟢 SYNC API: Store ID: <your-store-id-here>
```

## For Debugging "Store Not Found" Error

If you're getting "Store not found", check:

1. **Store exists and is active:**
```sql
SELECT id, shop_domain, is_active, user_id 
FROM stores 
WHERE id = 'YOUR_STORE_ID';
```

2. **Store belongs to your user:**
```sql
-- First get your user profile ID
SELECT id, auth_user_id 
FROM users 
WHERE auth_user_id = 'YOUR_AUTH_USER_ID';

-- Then check store ownership
SELECT s.id, s.shop_domain, s.user_id, u.id as user_profile_id
FROM stores s
JOIN users u ON s.user_id = u.id
WHERE s.id = 'YOUR_STORE_ID' 
  AND u.auth_user_id = 'YOUR_AUTH_USER_ID'
  AND s.is_active = true;
```

3. **Check what storeId is being sent:**
   - Open browser console
   - Look for: `🔵 SYNC MUTATION: Started with storeId: <id>`

