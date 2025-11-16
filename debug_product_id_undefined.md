# Debug "Failed to Load Resource" - Product ID is Undefined

The "Failed to load resource" error means the request URL is malformed, likely because `productId` is `undefined`.

## Quick Debug Steps

### Step 1: Check What Product IDs Are Available

**In browser console, run this on the Products page:**

```javascript
// Check React Query cache for products
const queryCache = window.__REACT_QUERY_CLIENT__?._queryCache;

if (queryCache) {
  const productsQuery = Array.from(queryCache.values())
    .find(q => q.queryKey?.[0] === 'products');
  
  if (productsQuery?.state?.data) {
    const products = productsQuery.state.data;
    console.log(`✅ Found ${products.length} products`);
    
    // Show first 3 products and their IDs
    products.slice(0, 3).forEach((product, i) => {
      console.log(`\n📦 Product ${i + 1}:`, {
        title: product.title,
        id: product.id,  // Shopify ID
        dbId: product.dbId,  // Internal UUID (might be undefined!)
        hasDbId: !!product.dbId,
        keys: Object.keys(product)
      });
    });
    
    // Check if any products have dbId
    const withDbId = products.filter(p => p.dbId);
    const withoutDbId = products.filter(p => !p.dbId);
    console.log(`\n✅ Products with dbId: ${withDbId.length}`);
    console.log(`❌ Products without dbId: ${withoutDbId.length}`);
    
    if (withoutDbId.length > 0) {
      console.log('\n⚠️ Products missing dbId:', withoutDbId.map(p => p.title));
    }
  } else {
    console.log('❌ No products found in React Query cache');
  }
} else {
  console.log('❌ React Query cache not found');
}
```

### Step 2: Check Network Tab

1. Open **Network tab** in DevTools (F12 → Network)
2. Click a product button
3. Look for a failed request
4. Check the **URL** of the failed request - what does it show?
   - Is it `/api/pricing/config/undefined`?
   - Is it `/api/pricing/config/null`?
   - Is it `/api/pricing/config/` (empty)?
   - Or something else?

### Step 3: Check Console Logs Before Click

**Before clicking**, check if there are any errors in console:
- Look for: `❌ CRITICAL ERROR: No valid productId found!`
- Look for: `🔍 [ProductCard] Initializing useSmartPricingToggle`

### Step 4: Check localStorage

```javascript
// Check what's stored
console.log('Store ID:', localStorage.getItem('selected-store-id'));

// Check if products are cached
const queryCache = window.__REACT_QUERY_CLIENT__?._queryCache;
if (queryCache) {
  const productsQuery = Array.from(queryCache.values())
    .find(q => q.queryKey?.[0] === 'products');
  
  if (productsQuery) {
    console.log('Products query exists:', !!productsQuery);
    console.log('Products data:', productsQuery.state?.data?.length || 0);
  }
}
```

## Most Likely Issues

### Issue 1: Products Don't Have `dbId`

**Symptom**: All products show `dbId: undefined`  
**Cause**: `useProducts` hook isn't setting `dbId` correctly  
**Fix**: Check `src/features/shopify-integration/hooks/useProducts.ts` line 162

### Issue 2: Product ID is Null/Undefined

**Symptom**: Console shows `apiProductId: undefined` or `null`  
**Cause**: Product object missing both `dbId` and `id`  
**Fix**: Products need to be synced or refresh page

### Issue 3: Products Not Loaded

**Symptom**: No products in React Query cache  
**Cause**: Products query failed or not running  
**Fix**: Check products query in console

## Quick Test Without Clicking

Run this to test the diagnostic endpoint with a product ID from the cache:

```javascript
// Get first product with any ID
const queryCache = window.__REACT_QUERY_CLIENT__?._queryCache;
const productsQuery = Array.from(queryCache.values())
  .find(q => q.queryKey?.[0] === 'products');

if (productsQuery?.state?.data?.[0]) {
  const product = productsQuery.state.data[0];
  const storeId = localStorage.getItem('selected-store-id');
  
  // Try dbId first, then id (Shopify ID)
  const testProductId = product.dbId || product.id;
  
  console.log('🧪 Testing with:', {
    productTitle: product.title,
    testProductId,
    hasDbId: !!product.dbId,
    hasId: !!product.id,
    storeId
  });
  
  if (testProductId && storeId) {
    fetch(`/api/debug/product-diagnosis?productId=${encodeURIComponent(testProductId)}`, {
      headers: { 'x-store-id': storeId }
    })
      .then(res => res.json())
      .then(data => {
        console.log('✅ Diagnostic successful!');
        console.log('Summary:', data.diagnostics.summary);
        console.log('Step 6:', data.diagnostics.step6_getVariantsByProductId);
      })
      .catch(err => {
        console.error('❌ Diagnostic failed:', err);
        console.error('This means the endpoint itself is broken or URL is malformed');
      });
  } else {
    console.error('❌ Missing testProductId or storeId:', { testProductId, storeId });
  }
} else {
  console.error('❌ No products found to test with');
}
```

## What to Share

Please run Step 1 and share:
1. ✅ How many products have `dbId`?
2. ✅ What does a product object look like? (share first product's keys and values)
3. ✅ What URL shows in Network tab when you click? (screenshot or copy URL)
4. ✅ Any console errors before clicking?

This will help identify why productId is undefined!

