# Debug dbId Lookup Issue

## Where dbId is Stored

**dbId is the `id` column (UUID) in the `products` table in Supabase.**

When products are synced:
1. Products are upserted into `products` table (line 160 in syncProducts.ts)
2. Supabase auto-generates a UUID for the `id` column
3. This UUID **IS** the dbId

**Schema**:
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- ← This IS dbId
  shopify_id TEXT NOT NULL,                        -- ← Shopify ID
  store_id UUID REFERENCES stores(id),
  ...
);
```

## How Lookup Works

**In `/api/shopify/products/route.ts`**:
```typescript
// 1. Get shopify_ids from Shopify API response
const shopifyIds = transformedProducts.map(p => p.id);

// 2. Lookup database UUIDs by matching shopify_id
const { data: dbProducts } = await supabaseAdmin
  .from('products')
  .select('id, shopify_id')  // id = dbId (UUID)
  .eq('store_id', store.id)
  .in('shopify_id', shopifyIds);

// 3. Create map: shopify_id → dbId
const dbIdMap = new Map(
  dbProducts?.map(p => [p.shopify_id, p.id]) || []
);

// 4. Add dbId to products
productsWithDbId = transformedProducts.map(product => ({
  ...product,
  dbId: dbIdMap.get(product.id) || null,
}));
```

## Why Lookup Might Fail

### Issue 1: Products Not in Database
**Symptom**: `dbIdMap.size` is 0 or much less than `shopifyIds.length`

**Reason**: Products haven't been synced yet

**Fix**: Run a product sync first

### Issue 2: Wrong Store ID
**Symptom**: Lookup returns 0 results even though products exist

**Reason**: `store.id` doesn't match products' `store_id`

**Check**: Verify `store.id` matches products in database

### Issue 3: Shopify ID Mismatch
**Symptom**: Lookup fails even though products exist

**Reason**: Shopify IDs from API don't match database `shopify_id`

**Check**: Compare Shopify IDs from API vs database

### Issue 4: Data Type Mismatch
**Symptom**: Lookup returns nothing even though IDs look the same

**Reason**: One is string, one is number (or vice versa)

**Check**: Ensure both are strings

## Debug Steps

### Step 1: Check if Products Are in Database

**Run in Supabase SQL Editor**:
```sql
-- Replace YOUR_STORE_ID with actual store ID
SELECT 
  COUNT(*) as total_products,
  MIN(created_at) as oldest_product,
  MAX(created_at) as newest_product
FROM products
WHERE store_id = 'YOUR_STORE_ID';
```

**Expected**: Should return count > 0 if products are synced

### Step 2: Check Server Logs

**Look for this log** when fetching products:
```
✅ Found X products with dbId in database out of Y from Shopify
```

**If X < Y**: Some products aren't in database (need to sync)
**If X = 0**: No products in database OR wrong store_id

### Step 3: Check Browser Console

**When products load**, check console for:
```
🔍 Sample product with dbId: {
  title: "...",
  id: "shopify_id",
  dbId: "uuid" or null,
  hasDbId: true/false
}
```

**If `hasDbId: false`**: Products aren't in database OR lookup failed

### Step 4: Test Lookup Query Manually

**In Supabase SQL Editor**, run the same query the API does:

```sql
-- Replace with actual values
DECLARE store_uuid UUID := 'YOUR_STORE_ID_HERE';
DECLARE shopify_ids TEXT[] := ARRAY['SHOPIFY_ID_1', 'SHOPIFY_ID_2'];

SELECT 
  id as dbId,
  shopify_id,
  title
FROM products
WHERE store_id = store_uuid
  AND shopify_id = ANY(shopify_ids);
```

**Expected**: Should return rows with both `dbId` and `shopify_id`

## Quick Verification Script

**Run in browser console** after products load:

```javascript
// Check what products have
const queryCache = window.__REACT_QUERY_CLIENT__?._queryCache;
const productsQuery = Array.from(queryCache.values())
  .find(q => q.queryKey?.[0] === 'products');

if (productsQuery?.state?.data) {
  const products = productsQuery.state.data;
  console.log(`Total products: ${products.length}`);
  
  const withDbId = products.filter(p => p.dbId);
  const withoutDbId = products.filter(p => !p.dbId);
  
  console.log(`✅ With dbId: ${withDbId.length}`);
  console.log(`❌ Without dbId: ${withoutDbId.length}`);
  
  if (withoutDbId.length > 0) {
    console.log('Products missing dbId:', withoutDbId.map(p => ({
      title: p.title,
      id: p.id,
      dbId: p.dbId
    })));
  }
  
  if (withDbId.length > 0) {
    console.log('Sample product with dbId:', {
      title: withDbId[0].title,
      id: withDbId[0].id,
      dbId: withDbId[0].dbId,
      dbIdIsUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(withDbId[0].dbId)
    });
  }
}
```

## Most Likely Issues

### 1. Products Not Synced Yet
**Fix**: Run product sync from products page

### 2. Wrong Store Selected
**Fix**: Check `localStorage.getItem('selected-store-id')` matches database

### 3. Products Synced to Different Store
**Fix**: Re-sync products to correct store

### 4. Lookup Query Failing Silently
**Check**: Look at server logs when fetching products

## What to Report Back

1. ✅ How many products are in your database? (Run SQL query)
2. ✅ What does server log show? (`✅ Found X products with dbId...`)
3. ✅ What does browser console show? (Products with/without dbId)
4. ✅ What's the store_id? (Check localStorage)

This will help identify where the lookup is failing!

