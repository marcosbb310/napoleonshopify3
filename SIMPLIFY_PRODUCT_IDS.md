# Simplify Product IDs - Remove Redundant dbId

## Current Problem

We're using **3 different IDs** for products:
1. `id` (Shopify ID) - `"1234567890"` (string)
2. `dbId` (Database UUID) - `"550e8400-e29b-41d4-a716-446655440000"` (UUID)
3. Database `id` column - Same as `dbId` (UUID)

**This is redundant!** We don't need `dbId` at all.

## Why dbId Exists

The `dbId` was added because:
- Frontend products use `id` = Shopify ID (for Shopify compatibility)
- API routes need to find products in database
- Database uses UUID for `id` and string for `shopify_id`

**But**: `getVariantsByProductId()` already handles BOTH!

## The Solution

**Just use Shopify ID everywhere!** The `getVariantsByProductId` function already:
1. ✅ Accepts Shopify ID (string) - queries by `shopify_product_id` or looks up in `products` table
2. ✅ Accepts UUID - queries by `product_id`

So we can:
- **Remove** `dbId` from product transformation
- **Always use** `product.id` (Shopify ID) for API calls
- **Let** `getVariantsByProductId` handle the lookup (it already does!)

## Changes Needed

### 1. Remove dbId from useProducts Hook
```typescript
// src/features/shopify-integration/hooks/useProducts.ts
// REMOVE this:
dbId: product.id, // Internal database UUID

// KEEP this:
id: product.shopify_id, // Shopify ID
```

### 2. Update ProductCard to Use Only Shopify ID
```typescript
// src/features/product-management/components/ProductCard.tsx
// CHANGE from:
const apiProductId = (product as any).dbId || product.id;

// TO:
const apiProductId = product.id; // Always Shopify ID
```

### 3. Remove dbId Lookup from /api/shopify/products
```typescript
// src/app/api/shopify/products/route.ts
// REMOVE the entire dbId lookup section (lines 118-215)
// Just return transformedProducts directly
```

## Benefits

1. ✅ **Simpler code** - No redundant ID field
2. ✅ **Less confusion** - One ID instead of three
3. ✅ **Works immediately** - No need to wait for products to sync to have `dbId`
4. ✅ **Less database queries** - No need to lookup dbId

## How It Works

### Current Flow (Complex)
```
Frontend: product.id = Shopify ID, product.dbId = UUID
         ↓
ProductCard: apiProductId = product.dbId || product.id
         ↓
API: /api/pricing/config/[apiProductId]
         ↓
getVariantsByProductId: Checks if UUID or Shopify ID
         ↓
Database: Query by product_id OR shopify_product_id
```

### Simplified Flow
```
Frontend: product.id = Shopify ID (only)
         ↓
ProductCard: apiProductId = product.id
         ↓
API: /api/pricing/config/[shopifyId]
         ↓
getVariantsByProductId: Recognizes it's Shopify ID
         ↓
Database: Query by shopify_product_id (already works!)
```

## Verification

The `getVariantsByProductId` function already handles Shopify IDs:

```typescript
// variantHelpers.ts line 139-258
if (isUUID(productId)) {
  // Query by product_id (UUID)
} else {
  // Query by shopify_product_id (Shopify ID) ✅ Already works!
}
```

So we're good to go!

