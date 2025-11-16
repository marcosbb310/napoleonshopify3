# Store Deactivation & User Mismatch Analysis

## Root Cause Found

Looking at the code, here's what likely happened:

### The Problem: OAuth Callback Logic

In `src/features/shopify-oauth/services/tokenService.ts` (lines 63-69):

```typescript
// Check if store already exists for this user
const { data: existingStore } = await supabase
  .from('stores')
  .select('id')
  .eq('shop_domain', shopDomain)
  .eq('user_id', userId)  // ⚠️ PROBLEM: Only checks for THIS user
  .single();
```

**What this means:**
- If you reconnect the same Shopify store (`napolen-test-store.myshopify.com`) but your `user_id` changed or doesn't match, it creates a **NEW store** instead of updating the existing one
- The old store stays in the database but becomes "orphaned" (belongs to old user_id)
- If someone manually deactivated it, it would become inactive

### Possible Scenarios

1. **User Profile Changed**: 
   - Your `auth_user_id` might have changed
   - Or a new user profile was created
   - OAuth callback created a new store for the new user profile
   - Old store remained but became inactive

2. **Manual Disconnect**:
   - Someone clicked "Disconnect Store" in the UI
   - This sets `is_active = false` (see `useStores.ts` line 146)
   - But doesn't change `user_id`

3. **Database Migration/Cleanup**:
   - A migration script might have reassigned stores
   - Or a cleanup script deactivated old stores

4. **OAuth Reconnection with Different User**:
   - If you reconnected the store while logged in as a different user (or user profile changed)
   - New store created, old one left inactive

## How to Prevent This

### Fix 1: Update OAuth Logic to Check by Shop Domain Only

The OAuth callback should check if a store exists by `shop_domain` **regardless of user**, then update it:

```typescript
// Better approach: Check by shop_domain first, then update user_id if needed
const { data: existingStore } = await supabase
  .from('stores')
  .select('id, user_id')
  .eq('shop_domain', shopDomain)
  .single();

if (existingStore) {
  // Update existing store, including user_id if it changed
  await supabase
    .from('stores')
    .update({
      user_id: userId,  // Update to current user
      is_active: true,  // Reactivate if it was inactive
      // ... other fields
    })
    .eq('id', existingStore.id);
}
```

### Fix 2: Add Audit Logging

Track when stores are deactivated or user_id changes:

```sql
CREATE TABLE IF NOT EXISTS store_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  action TEXT NOT NULL, -- 'deactivated', 'user_changed', 'reconnected'
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Immediate Fix

Run this to fix your current store:

```sql
-- Reactivate and reassign to correct user
UPDATE stores
SET 
  is_active = true,
  user_id = 'af37bd93-c6f6-477e-8a2e-626364cda03a',  -- Your user profile ID
  updated_at = NOW()
WHERE id = '7bd653c6-387e-48fd-bf41-8b50829c07a4';
```

## Investigation Queries

Run these to see what happened:

```sql
-- Check if there are multiple stores with same shop_domain
SELECT 
  shop_domain,
  COUNT(*) as store_count,
  array_agg(id) as store_ids,
  array_agg(user_id) as user_ids,
  array_agg(is_active::text) as active_statuses
FROM stores
WHERE shop_domain = 'napolen-test-store.myshopify.com'
GROUP BY shop_domain;

-- Check store update history (if you have updated_at tracking)
SELECT 
  id,
  shop_domain,
  is_active,
  user_id,
  created_at,
  updated_at
FROM stores
WHERE shop_domain = 'napolen-test-store.myshopify.com'
ORDER BY updated_at DESC;

-- Check if there are other user profiles that might have been used
SELECT 
  id,
  auth_user_id,
  email,
  created_at
FROM users
WHERE email = 'cursortest@gmail.com' OR email ILIKE '%cursor%'
ORDER BY created_at DESC;
```

## Recommendation

1. **Fix the immediate issue** (run the UPDATE query above)
2. **Investigate** what caused it (run the investigation queries)
3. **Fix the OAuth logic** to prevent this in the future (update tokenService.ts)

