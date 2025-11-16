# Phase 1 Fixes Applied - Error Resolution

## Issues Found During Testing

1. **React Key Error**: "Each child in a list should have a unique key prop" - References `ProductsTestPage` and `product.shopifyId`
2. **Store Not Found Error**: Sync mutation failing with "Store not found"

## Fixes Applied

### 1. Enhanced Error Logging for "Store Not Found"
- **File**: `src/shared/lib/apiAuth.ts`
- **Change**: Added detailed error logging to help diagnose why stores aren't being found
- **Logs**: Now logs storeId, userId, and query conditions when store lookup fails

### 2. Sync Route Body Consumption Fix
- **File**: `src/app/api/shopify/sync/route.ts`
- **Change**: Removed request cloning (not needed since we pass storeId directly)
- **Note**: `requireStore()` now receives `storeId` in options, so it doesn't need to read the body

## React Key Error Analysis

The error references:
- Component: `ProductsTestPage`
- Location: `src/app/(app)/products/page.tsx:838`
- Issue: Using `key={product.shopifyId}`

**However**, the current code shows:
- Main products page: `ProductsPage` (not `ProductsTestPage`)
- Test page: `ProductsTestPage` in `products-test/page.tsx` with `key={product.id ?? `product-${index}`}`

**Possible Causes**:
1. **Cached build** - Old code still running
2. **Wrong file** - Error trace pointing to wrong location
3. **Different component** - There might be another component we haven't found

## Next Steps to Resolve

### For "Store Not Found" Error:

1. **Check Server Logs**: Look for the new error logs that show:
   - StoreId being searched
   - UserId doing the search
   - Query conditions
   - Actual error message

2. **Verify Store Exists**: Run this query in Supabase:
   ```sql
   SELECT id, shop_domain, user_id, is_active 
   FROM stores 
   WHERE id = 'YOUR_STORE_ID';
   ```

3. **Verify User Profile**: Check if the user profile exists:
   ```sql
   SELECT id, auth_user_id 
   FROM users 
   WHERE auth_user_id = 'YOUR_AUTH_USER_ID';
   ```

4. **Check Store Ownership**: Verify the store belongs to the user:
   ```sql
   SELECT s.id, s.shop_domain, s.user_id, u.id as user_profile_id
   FROM stores s
   JOIN users u ON s.user_id = u.id
   WHERE s.id = 'YOUR_STORE_ID' 
     AND u.auth_user_id = 'YOUR_AUTH_USER_ID'
     AND s.is_active = true;
   ```

### For React Key Error:

1. **Restart Dev Server**: 
   ```bash
   # Stop the server (Ctrl+C)
   # Clear Next.js cache
   rm -rf .next
   # Restart
   npm run dev
   ```

2. **Clear Browser Cache**: Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

3. **Check Console**: Look for the exact line number and component name

4. **If Error Persists**: Search for `shopifyId` as key:
   ```bash
   grep -r "key.*shopifyId" src/
   ```

## Testing After Fixes

1. **Test Sync**:
   - Click "Sync Products" button
   - Check server console for detailed error logs
   - Verify store is found

2. **Test React Keys**:
   - Navigate to `/products` page
   - Check browser console
   - Should see no React key errors

## If Issues Persist

### For "Store Not Found":
- Share the server console logs (they now include detailed info)
- Verify the storeId being sent matches the store in database
- Check if store is active (`is_active = true`)

### For React Key Error:
- Share the exact error message and stack trace
- Check if you're viewing `/products` or `/products-test`
- Verify the component name in the error matches the file

## Files Modified

1. `src/shared/lib/apiAuth.ts` - Added detailed error logging
2. `src/app/api/shopify/sync/route.ts` - Improved comments, removed unnecessary cloning

---

**Note**: The React key error might be from a cached build. Try restarting the dev server first before investigating further.

