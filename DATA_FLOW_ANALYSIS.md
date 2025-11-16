# Data Flow Analysis - dbId Issue

## 🔴 THE PROBLEM

The products page is fetching products from **Shopify API** instead of **your database**, so products don't have `dbId`.

---

## Current Data Flow

### Step 1: Products Page
```typescript
// src/app/(app)/products/page.tsx line 142
const { products } = useProducts(selectedStoreId, {...});
```

### Step 2: useProducts Hook
```typescript
// src/features/shopify-integration/hooks/useProducts.ts
// This calls: /api/shopify/products
const res = await authenticatedFetch('/api/shopify/products');
```

### Step 3: API Route Returns Shopify API Data
```typescript
// src/app/api/shopify/products/route.ts line 63-115
// Returns products from Shopify API - NO dbId!
return {
  id: product.id.toString(),  // Shopify ID only
  // ❌ NO dbId - because it's from Shopify, not database!
};
```

### Step 4: ProductCard Tries to Use dbId
```typescript
// src/features/product-management/components/ProductCard.tsx line 95
const apiProductId = (product as any).dbId || product.id;
// ❌ dbId is undefined! Falls back to product.id (Shopify ID)
```

### Step 5: API Call Fails
```typescript
// URL becomes: /api/pricing/config/[shopify_id]
// But API expects dbId OR looks up by shopify_id
// ❌ If shopify_id lookup fails → 404 error
```

---

## What's Missing

**The `/api/shopify/products` endpoint needs to:**
1. ✅ Fetch products from Shopify API (for latest data)
2. ❌ ALSO lookup `dbId` from database (for API calls)
3. ❌ Return both `id` (Shopify ID) and `dbId` (Database UUID)

---

## ✅ Solution Options

### Option 1: Add dbId Lookup to `/api/shopify/products` (RECOMMENDED)

Modify `/api/shopify/products` to:
1. Fetch products from Shopify API
2. For each product, lookup `dbId` from database using `shopify_id`
3. Return products with both `id` (Shopify ID) and `dbId` (Database UUID)

### Option 2: Use Database Query Instead

Change products page to use `useProducts` from `product-management` hook which queries database directly.

### Option 3: Hybrid Approach

Create a new endpoint that merges Shopify data with database IDs.

---

## Recommended Fix: Option 1

Modify `/api/shopify/products/route.ts` to include `dbId` lookup:

```typescript
// After fetching from Shopify API, lookup dbId from database
const { data: dbProducts } = await supabase
  .from('products')
  .select('id, shopify_id')
  .eq('store_id', store.id)
  .in('shopify_id', transformedProducts.map(p => p.id));

// Create a map for quick lookup
const dbIdMap = new Map(
  dbProducts?.map(p => [p.shopify_id, p.id]) || []
);

// Add dbId to each product
const productsWithDbId = transformedProducts.map(product => ({
  ...product,
  dbId: dbIdMap.get(product.id) || null,  // Add dbId
}));
```

---

## Why This Happens

1. **Shopify API** returns only Shopify IDs
2. **Database** has both Shopify IDs and UUIDs (dbId)
3. **Frontend** needs dbId for API calls
4. **Missing link**: No code to connect Shopify IDs to database UUIDs

---

## Impact

- ✅ **Global button works** (doesn't need individual product IDs)
- ❌ **Individual buttons fail** (need dbId, but product objects don't have it)
- ❌ **"Failed to load resource"** (URL becomes `/api/pricing/config/undefined`)

---

## Next Steps

1. Modify `/api/shopify/products/route.ts` to include dbId lookup
2. Test that products now have dbId
3. Individual product buttons should work

