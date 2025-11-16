# Debug "Product not found for this store" Error

## The Issue

The error "Product not found for this store" means:
- ✅ The store ID is being passed correctly
- ❌ But no variants exist for that **combination** of:
  - `shopify_product_id` = product Shopify ID
  - `store_id` = store UUID

## What Store ID Is Being Used?

The store ID comes from:

1. **Frontend**: `useCurrentStore()` hook
   - Gets selected store from `localStorage.getItem('selected-store-id')`
   - Or defaults to first store in list

2. **API Client**: `useAuthenticatedFetch()`
   - Reads `currentStore.id` from `useCurrentStore()`
   - Adds `x-store-id` header to all API calls

3. **API Route**: `requireStore(request)`
   - Reads `x-store-id` header
   - Verifies store belongs to user
   - Returns store object

4. **Variant Lookup**: `getVariantsByProductId(productId, store.id)`
   - Uses store ID to filter variants
   - Queries: `.eq('shopify_product_id', productId).eq('store_id', store.id)`

## Most Likely Causes

### Issue 1: Products Synced to Different Store

**Symptom**: Product exists in database but belongs to different store

**Check**: Look at server logs - it now shows:
```
variantsInOtherStores: [
  { variantStoreId: "other-store-uuid", isSameStore: false }
]
requestedStoreId: "current-store-uuid"
```

**Fix**: 
1. Run product sync for the correct store
2. OR select the correct store that has the products

### Issue 2: Products Not Synced Yet

**Symptom**: No variants found in any store

**Check**: Server logs show:
```
variantsFoundInAnyStore: 0
productsFoundInAnyStore: 0
```

**Fix**: Run a product sync first

### Issue 3: Wrong Store Selected

**Symptom**: Products synced but to different store than selected

**Check**: 
1. Check browser console for selected store ID
2. Compare with database store IDs

**Fix**: Select the correct store in the UI

## How to Debug

### Step 1: Check Selected Store ID

**In browser console**, run:
```javascript
// Check selected store
const selectedStoreId = localStorage.getItem('selected-store-id');
console.log('Selected store ID:', selectedStoreId);

// Check current store from hook
const queryCache = window.__REACT_QUERY_CLIENT__?._queryCache;
const storesQuery = Array.from(queryCache.values())
  .find(q => q.queryKey?.[0] === 'stores');

if (storesQuery?.state?.data) {
  console.log('Available stores:', storesQuery.state.data.map(s => ({
    id: s.id,
    shop_domain: s.shop_domain,
    isSelected: s.id === selectedStoreId
  })));
}
```

### Step 2: Check Server Logs

**When you click the button**, check terminal for:
```
🔍 ===== SMART PRICING TOGGLE DEBUG =====
🔍 Store ID provided: [store-uuid]
🔍 Store ID is UUID: true
========================================

❌ [getVariantsByProductId] No variants found: {
  requestedStoreId: "[store-uuid]",
  variantsInOtherStores: [...],
  productsInOtherStores: [...],
  message: "..."
}
```

### Step 3: Check Database

**In Supabase SQL Editor**, run:
```sql
-- Check what stores you have
SELECT id, shop_domain FROM stores;

-- Check which store the product belongs to
SELECT 
  pv.shopify_product_id,
  pv.store_id,
  s.shop_domain,
  COUNT(*) as variant_count
FROM product_variants pv
JOIN stores s ON pv.store_id = s.id
WHERE pv.shopify_product_id = 'YOUR_SHOPIFY_PRODUCT_ID'
GROUP BY pv.shopify_product_id, pv.store_id, s.shop_domain;

-- Check your selected store
-- (Get from browser: localStorage.getItem('selected-store-id'))
SELECT id, shop_domain FROM stores WHERE id = 'YOUR_SELECTED_STORE_ID';
```

## Quick Fix

If products belong to a different store:

1. **Option 1**: Select the correct store
   - Go to Settings or store selector
   - Select the store that has your products

2. **Option 2**: Sync products to current store
   - Make sure correct store is selected
   - Click "Sync Products" button
   - Wait for sync to complete

## What the New Logging Shows

The enhanced logging now shows:
- ✅ What store ID you're using
- ✅ What stores the product/variants actually belong to
- ✅ Whether there's a mismatch
- ✅ Specific error message explaining the issue

This makes it much easier to diagnose the problem!

