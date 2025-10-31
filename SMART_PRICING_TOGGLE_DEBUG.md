# Smart Pricing Toggle "Product Not Found" Error - Root Cause Analysis

## The Problem
When clicking "Smart Pricing OFF", the error "Product not found" appears, even though the product is visible on the page.

## Data Flow

### 1. Products Are Fetched From Database
```typescript
// useProducts.ts line 58-87
// Queries Supabase for products with store_id
// Returns products with:
{
  id: "uuid-internal-id",        // Internal database UUID
  shopify_id: "12345678",         // Shopify's product ID (string)
  store_id: "store-uuid",         // Which store
  title: "Product Name",
  pricing_config: [{ auto_pricing_enabled: true }]
}
```

### 2. Frontend Transforms The Data
```typescript
// useProducts.ts line 128
id: product.shopify_id,  // ⚠️ Uses shopify_id as the ID!

// So frontend products have:
{
  id: "12345678",  // This is shopify_id
  title: "Product Name",
  ...
}
```

### 3. When Toggle Is Clicked
```typescript
// ProductCard passes product.id to API
fetch(`/api/pricing/config/${productId}`, ...)
// productId = "12345678" (the shopify_id)
```

### 4. API Tries To Find The Product
```typescript
// config/[productId]/route.ts
// First tries by UUID (won't work - we're sending shopify_id)
await supabase.from('products').eq('id', productId).single();

// Then tries by shopify_id (should work)
await supabase.from('products')
  .eq('shopify_id', productId)
  .eq('store_id', storeId)  // ⚠️ FILTERS BY STORE
  .single();
```

## The Root Causes

### Possible Issue #1: Store ID Mismatch
Products might belong to a different `store_id` than the authenticated user's store.

### Possible Issue #2: No Pricing Config Record
The product exists but doesn't have a `pricing_config` record yet, causing the lookup to fail.

### Possible Issue #3: ID Type/Format Mismatch
The `shopify_id` in the database might be a different format (number vs string).

## What To Check

### Check Your Terminal When You Click Toggle

Look for these log messages:

```
🔍 ===== SMART PRICING TOGGLE DEBUG =====
🔍 Received productId: "12345678"
🔍 Store ID provided: "xxx-xxx-xxx" OR "NOT PROVIDED"
🔍 Shopify lookup result: { hasError: true/false, ... }
🔍 Sample products in database: [...]
```

### If Store ID Is "NOT PROVIDED"
This means the authentication isn't working properly.

### If Store ID Is Provided But Product Isn't Found
This means either:
- The product's `shopify_id` doesn't match
- The product belongs to a different store
- The product doesn't have a `pricing_config` record

## The Fix

I've added extensive logging. **Check your server terminal** (where Next.js is running) and look for:

1. What `productId` is being sent
2. What the database returns
3. Whether store_id filtering is working

**Copy and paste those server logs here** so I can see exactly what's happening.

