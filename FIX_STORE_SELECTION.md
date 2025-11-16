# Fix Store Selection - Switch to Revenue Test Store

## Step 1: Find the Correct Store ID

Run this in **Supabase SQL Editor** to find your revenue test store:

```sql
-- Find all your stores
SELECT 
  id as store_id,
  shop_domain,
  is_active,
  user_id,
  created_at,
  updated_at,
  last_synced_at
FROM stores
ORDER BY created_at DESC;
```

Look for the store with `shop_domain` containing "revenue" - that's your correct store ID.

## Step 2: Update Store Selection (Choose One Method)

### Method A: Browser Console (Easiest - Immediate)

1. Open your app in browser
2. Open DevTools (F12) → Console tab
3. Run this (replace with your correct store ID):

```javascript
// Set the correct store ID
localStorage.setItem('selected-store-id', 'YOUR_REVENUE_STORE_ID_HERE');

// Verify it was set
console.log('New store ID:', localStorage.getItem('selected-store-id'));

// Reload the page to apply changes
window.location.reload();
```

### Method B: Use the UI Store Selector

1. Go to `/products` page
2. Look for the store dropdown selector (top of page)
3. Select the "revenue test store" from the dropdown
4. This will automatically update localStorage

### Method C: Clear and Let It Auto-Select

If you want the app to automatically select the first (most recent) store:

```javascript
// Clear the saved store
localStorage.removeItem('selected-store-id');

// Reload page - it will auto-select the first store
window.location.reload();
```

## Step 3: Verify the Change

After updating, check:

1. **Browser Console**: Look for logs like:
   ```
   ✅ Using saved store: <new-store-id>
   🔍 Store selection check: { saved: '<new-store-id>', ... }
   ```

2. **Products Page**: Should show products from the revenue test store

3. **Sync Button**: When you click sync, check server logs:
   ```
   🟢 SYNC API: Store ID: <new-store-id>
   🟢 SYNC API: Store found: revenue-test-store.myshopify.com
   ```

## Step 4: (Optional) Deactivate Old Store

If you want to deactivate the old "napoleon test store" so it doesn't appear in the list:

```sql
-- Deactivate the old store (replace with old store ID)
UPDATE stores
SET is_active = false,
    updated_at = NOW()
WHERE id = '7bd653c6-387e-48fd-bf41-8b50829c07a4';  -- Old napoleon store ID

-- Verify it's deactivated
SELECT id, shop_domain, is_active 
FROM stores 
WHERE id = '7bd653c6-387e-48fd-bf41-8b50829c07a4';
```

**Note**: Deactivating won't delete the store, just hide it from the UI. You can reactivate it later if needed.

## Quick Fix Script

Run this in browser console (after finding your revenue store ID):

```javascript
// Quick fix: Update to revenue test store
const revenueStoreId = 'YOUR_REVENUE_STORE_ID_HERE'; // Replace this!

localStorage.setItem('selected-store-id', revenueStoreId);
console.log('✅ Store updated to:', revenueStoreId);
console.log('🔄 Reloading page...');
setTimeout(() => window.location.reload(), 500);
```

## Troubleshooting

### If store still doesn't switch:

1. **Clear all cache**:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   window.location.reload();
   ```

2. **Check if store exists and is active**:
   ```sql
   SELECT id, shop_domain, is_active 
   FROM stores 
   WHERE shop_domain ILIKE '%revenue%';
   ```

3. **Verify store belongs to your user**:
   ```sql
   -- Get your user ID first
   SELECT id, auth_user_id FROM users;
   
   -- Then check store ownership
   SELECT s.id, s.shop_domain, s.user_id, u.id as user_profile_id
   FROM stores s
   JOIN users u ON s.user_id = u.id
   WHERE s.shop_domain ILIKE '%revenue%';
   ```

