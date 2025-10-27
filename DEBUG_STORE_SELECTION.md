# Debug Store Selection Issue

## The Problem

After adding the second store (`napolen-test-store`), the products page stopped loading. The root cause is store selection logic not properly handling multiple stores.

## What I Fixed

### 1. Simplified Store Selection Logic (`useCurrentStore.ts`)

**Before:** Had two separate useEffect hooks that could conflict:
- One to load from localStorage on mount
- Another to auto-select first store

**After:** Single unified effect that:
- Checks localStorage for saved store
- Verifies saved store exists in available stores
- Falls back to first store if invalid
- Always ensures a valid store is selected

### 2. Added Comprehensive Logging

Added console logs at critical points:
- **Store selection check** - Shows what's in localStorage and available stores
- **API call tracking** - Shows which store ID is being used for each request
- **Server-side logging** - Shows which store is being fetched from database

## How to Debug

### Step 1: Check Browser Console

Look for these log messages:

```javascript
🔍 Store selection check: {
  saved: "...",
  availableStores: [...],
  currentStoreId: "..."
}
```

This shows what store is in localStorage vs what stores are available.

### Step 2: Check Network Requests

In the Network tab, look at the request to `/api/shopify/products` and check the `x-store-id` header.

### Step 3: Check Server Logs

Look for:
```javascript
🔍 Fetching products for store: {
  storeId: "...",
  shopDomain: "...",
  hasToken: true,
  tokenLength: 50,
  scope: "read_products,write_products,read_orders"
}
```

### Step 4: Check for 403 Errors

If you see:
```javascript
❌ Shopify 403 Error: {
  storeId: "...",
  shopDomain: "...",
  tokenLength: 50,
  message: "Forbidden"
}
```

This means the token for that store is invalid.

## Common Issues

### Issue 1: Wrong Store Selected

**Symptom:** Products from the wrong store show up.

**Debug:**
1. Check localStorage: `localStorage.getItem('selected-store-id')`
2. Check console for "Store selection check" log
3. Verify the store ID matches what you expect

**Fix:** Use the StoreSelector dropdown in the navbar to switch stores manually.

### Issue 2: No Products Loading

**Symptom:** Empty products list or error message.

**Debug:**
1. Check console for "API call with store" log
2. Verify the store has a token and scope
3. Check server logs for 403 errors

**Fix:**
- If 403: Token is invalid, reconnect the store
- If no scope: Reconnect the store to get proper permissions

### Issue 3: Page Loads Then Breaks

**Symptom:** Products load initially, then disappear.

**Debug:**
1. Check for multiple "Store selection check" logs
2. Look for store switching happening unexpectedly
3. Check if localStorage is being cleared

**Fix:** Clear localStorage and reload: `localStorage.clear(); location.reload()`

## Testing the Fix

1. **Clear localStorage:**
   ```javascript
   localStorage.clear()
   ```

2. **Reload the page:**
   - Should auto-select first store
   - Console should show: "🔄 No valid saved store, using first store"

3. **Switch stores using dropdown:**
   - Should update localStorage
   - Console should show: "🔄 Store switch"

4. **Check products load for each store:**
   - Console should show correct store ID in "📤 API call with store"
   - Products should match the selected store

## Expected Behavior

✅ **Page loads** → First store auto-selected
✅ **Switch store** → localStorage updated, cache cleared
✅ **Products load** → Correct products for selected store
✅ **Console logs** → Clear tracking of which store is used
✅ **Server logs** → Shows correct store info

## Next Steps

Once we see the console logs, we can determine:
1. Is the wrong store being selected?
2. Is the store ID being sent correctly?
3. Is the token for that store valid?
4. Are the permissions (scope) correct?

Open browser console, navigate to the products page, and share the console output.

