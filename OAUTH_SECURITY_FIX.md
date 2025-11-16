# OAuth Security Fix - Prevent Duplicate Stores & Unauthorized Reassignment

## Problem Fixed

**Before**: The OAuth callback could create duplicate stores or silently reassign stores to different users, causing:
- Data corruption
- Loss of user trust
- Orphaned products
- Confusion about which store belongs to which user

**After**: The OAuth callback now:
1. ✅ Updates existing store if it belongs to the current user (reconnect)
2. ✅ **Prevents duplicate stores** - throws error if store exists for another user
3. ✅ Only creates new store if shop_domain doesn't exist at all
4. ✅ Reactivates stores if they were deactivated

## What Changed

### File: `src/features/shopify-oauth/services/tokenService.ts`

**New Logic Flow:**
1. **Check if store exists for THIS user** → Update it (reconnect)
2. **Check if store exists for ANOTHER user** → **Throw error** (prevent duplicate)
3. **Store doesn't exist** → Create new store

## User Experience

### Scenario 1: Reconnecting Your Own Store ✅
**What happens:**
- User clicks "Reconnect Store" for their own store
- OAuth completes successfully
- Store is updated with new tokens and reactivated
- **User sees**: "Store connected successfully!"

### Scenario 2: Trying to Connect Store Already Connected to Another Account ❌
**What happens:**
- User tries to connect a Shopify store
- OAuth completes, but store already exists for different user
- **Error is thrown** before creating duplicate
- **User sees**: Clear error message in OAuth popup:
  ```
  ❌ Failed to Store Tokens
  Error: This Shopify store is already connected to another account. 
  If you believe this is an error, please contact support. 
  To reconnect your store, please disconnect it first from the other account.
  ```
- OAuth popup closes after 3 seconds
- User is redirected to dashboard
- **No duplicate store is created** ✅

### Scenario 3: Connecting New Store ✅
**What happens:**
- User connects a Shopify store for the first time
- OAuth completes successfully
- New store is created
- **User sees**: "Store connected successfully!"

## Security Benefits

1. **No Duplicate Stores**: Prevents data corruption from duplicate stores
2. **No Unauthorized Reassignment**: Store can't be "stolen" by another user
3. **Clear Error Messages**: Users know exactly what went wrong
4. **Data Integrity**: Products stay linked to correct store/user

## Edge Cases Handled

### Store Was Deactivated
- If user reconnects their own deactivated store, it's automatically reactivated
- `is_active` is set to `true` during update

### User Profile Changed
- If user's profile ID changed but they reconnect the same store
- The error will catch it and prevent duplicate creation
- User needs to contact support to reassign the store

### Multiple Users, Same Store (Legitimate)
- If two different users legitimately need to connect the same Shopify store
- They need to coordinate: one disconnects, other connects
- Or contact support for multi-user store support (future feature)

## Testing

To test this fix:

1. **Test Reconnect** (should work):
   - Disconnect your store
   - Reconnect it
   - Should update existing store, not create duplicate

2. **Test Duplicate Prevention** (should fail gracefully):
   - Have User A connect a store
   - Have User B try to connect the same store
   - Should see error message, no duplicate created

3. **Test New Store** (should work):
   - Connect a store that doesn't exist
   - Should create new store successfully

## Migration Notes

**Existing Duplicate Stores:**
If you already have duplicate stores in your database, you'll need to clean them up manually:

```sql
-- Find duplicate stores
SELECT 
  shop_domain,
  COUNT(*) as count,
  array_agg(id) as store_ids,
  array_agg(user_id) as user_ids
FROM stores
GROUP BY shop_domain
HAVING COUNT(*) > 1;

-- Decide which to keep, then delete the others
-- (Keep the one with most products or most recent activity)
```

## Future Enhancements

1. **Multi-User Store Support**: Allow multiple users to share a store (with permissions)
2. **Store Transfer**: Allow users to transfer store ownership
3. **Audit Logging**: Track all store connection/disconnection events
4. **Admin Override**: Allow admins to reassign stores in edge cases

