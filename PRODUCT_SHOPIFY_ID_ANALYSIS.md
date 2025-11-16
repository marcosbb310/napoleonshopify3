# Product `shopify_id` Assignment Analysis

## 🔍 Overview

This document identifies **every place** where products are inserted or updated in Supabase, specifically tracking where `shopify_id`, `shopify_product_id`, and `product.id` are set. It identifies code paths that could result in a product record with a **null `shopify_id`** stored in Supabase.

---

## 📊 Database Schema

### Products Table Schema

**File**: `supabase/migrations/001_initial_schema.sql` (Line 12-22)

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_id TEXT UNIQUE NOT NULL,  -- ⚠️ NOT NULL constraint
  title TEXT NOT NULL,
  vendor TEXT,
  product_type TEXT,
  starting_price DECIMAL(10, 2) NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Constraint**: `shopify_id TEXT UNIQUE NOT NULL`
- Database **should** prevent NULL values
- However, if constraint is missing or bypassed, NULL could be inserted

---

## 1. 🔄 Shopify → Supabase Syncing

### 1.1 Primary Sync Function

**File**: `src/features/shopify-integration/services/syncProducts.ts`  
**Function**: `processProductBatch()`  
**Lines**: 141-196

```145:157:src/features/shopify-integration/services/syncProducts.ts
  // Prepare products for upsert
  const productsToUpsert = products.map(product => ({
    store_id: storeId,
    shopify_id: product.id,
    title: product.title,
    handle: product.handle,
    vendor: product.vendor,
    product_type: product.productType,
    tags: product.tags || [],
    status: product.status,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
    is_active: true,
  }));
```

**Upsert Operation** (Lines 160-165):
```160:165:src/features/shopify-integration/services/syncProducts.ts
  // Upsert products
  const { error: productsError } = await supabase
    .from('products')
    .upsert(productsToUpsert, {
      onConflict: 'store_id,shopify_id',
      ignoreDuplicates: false,
    });
```

### ⚠️ **CRITICAL ISSUE: `product.id` Could Be Undefined**

**Problem Scenarios**:

1. **Shopify API Returns Product Without ID**:
   - If Shopify API response is malformed
   - If `product.id` is `undefined` or `null` in the response
   - **Result**: `shopify_id: undefined` → Database constraint violation OR NULL if constraint missing

2. **Type Coercion Issue**:
   - If `product.id` is `null` (not `undefined`)
   - JavaScript: `null` → `"null"` (string) OR `null` (if not stringified)
   - **Result**: `shopify_id: "null"` (string) OR `shopify_id: null` (if constraint bypassed)

3. **Race Condition During Upsert**:
   - If `product.id` changes between mapping and upsert
   - If product object is mutated
   - **Result**: Wrong or missing `shopify_id`

### 1.2 Legacy Sync Function (napoleonshopify3)

**File**: `napoleonshopify3/src/features/shopify-integration/services/syncProducts.ts`  
**Function**: `syncProductsFromShopify()`  
**Lines**: 77-92

```77:92:napoleonshopify3/src/features/shopify-integration/services/syncProducts.ts
        const { data: upsertedProduct, error: upsertError } = await supabase
          .from('products')
          .upsert({
            store_id: storeId,
            shopify_id: product.shopifyId ?? product.id,
            title: product.title,
            vendor: product.vendor || null,
            product_type: product.productType || null,
            starting_price: price,
            current_price: price,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'store_id,shopify_id',
          })
          .select('id')
          .single();
```

**⚠️ Fallback Logic**: `product.shopifyId ?? product.id`
- If both are `undefined`/`null`, `shopify_id` becomes `undefined`
- **Result**: NULL in database (if constraint bypassed)

### 1.3 Product Lookup After Upsert

**File**: `src/features/shopify-integration/services/syncProducts.ts`  
**Lines**: 181-194

```181:194:src/features/shopify-integration/services/syncProducts.ts
    // First, get the internal database ID for this product
    const { data: dbProduct } = await supabase
      .from('products')
      .select('id')
      .eq('store_id', storeId)
      .eq('shopify_id', product.id)
      .single();
    
    if (dbProduct) {
      // Use the internal database UUID
      // Process ALL variants - each one is an independent priced entity
      await processProductVariants(storeId, dbProduct.id, product.variants, product.id);
    } else {
      console.error(`❌ Could not find internal ID for product with shopify_id: ${product.id}`);
    }
```

**⚠️ Issue**: If `product.id` is `undefined`, query fails silently
- Product may be inserted with `shopify_id: undefined`
- Lookup fails, variants not processed
- **Result**: Product exists in database with NULL `shopify_id` (if constraint missing)

---

## 2. 📝 Product Creation (Manual)

### 2.1 API Route - POST /api/shopify/products

**File**: `src/app/api/shopify/products/route.ts`  
**Function**: `POST()`  
**Lines**: 227-300

**⚠️ CRITICAL**: This route **creates products in Shopify**, but **DOES NOT insert into Supabase**!

```227:292:src/app/api/shopify/products/route.ts
export async function POST(request: NextRequest) {
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
    const body = await request.json();
    const { title, description, vendor, productType, tags, status, variants, images } = body;

    // Build Shopify product payload
    const productPayload = {
      product: {
        title,
        body_html: description || '',
        vendor: vendor || '',
        product_type: productType || '',
        tags: Array.isArray(tags) ? tags.join(', ') : (tags || ''),
        status: status || 'active',
        variants: (variants || []).map((v: Record<string, unknown>) => ({
          title: v.title || 'Default',
          price: v.price || '0.00',
          compare_at_price: v.compareAtPrice || null,
          sku: v.sku || '',
          inventory_quantity: v.inventoryQuantity || 0,
          inventory_management: v.inventoryManagement || null,
          weight: v.weight || null,
          weight_unit: v.weightUnit || 'kg',
        })),
        images: (images || []).map((img: Record<string, unknown>) => ({
          src: img.src,
          alt: img.alt || '',
        })),
      },
    };

    const baseUrl = `https://${store.shop_domain}/admin/api/${apiVersion}`;

    const res = await fetch(`${baseUrl}/products.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': store.access_token, // NEW AUTH: Use decrypted token
      },
      body: JSON.stringify(productPayload),
      cache: 'no-store',
    });

    if (!res.ok) {
      let errorMessage: string = `Shopify create failed with status ${res.status}`;
      try {
        const err = await res.json();
        if (err && err.errors) {
          errorMessage = typeof err.errors === 'string' ? err.errors : JSON.stringify(err.errors);
        }
      } catch {
        // ignore JSON parse error
      }
      return NextResponse.json(
        { success: false, error: { message: errorMessage, statusCode: res.status } },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, data: data.product }, { status: 201 });
```

**⚠️ Problem**: 
- Product created in Shopify
- **NOT synced to Supabase automatically**
- User must run a sync to get it into database
- If sync fails or product is deleted from Shopify before sync, product never appears in Supabase

### 2.2 Test Product Creation

**File**: `napoleonshopify3/src/app/api/test/create-product/route.ts`  
**Lines**: 26-41

```26:41:napoleonshopify3/src/app/api/test/create-product/route.ts
    // Create a test product
    const testProduct = {
      store_id: store.id,
      shopify_id: `test-product-${Date.now()}`,
      title: `Test Product for First Increase - ${new Date().toLocaleString()}`,
      vendor: 'Test Vendor',
      product_type: 'Test Type',
      starting_price: 10.00,
      current_price: 10.00,
      updated_at: new Date().toISOString(),
    };

    const { data: product, error } = await supabase
      .from('products')
      .insert(testProduct)
      .select()
      .single();
```

**✅ Safe**: Uses synthetic `shopify_id` - always has a value

---

## 3. 🔄 Product Edits/Updates

### 3.1 Webhook Handler - Product Update

**File**: `src/app/api/webhooks/shopify/product-update/route.ts`  
**Function**: `POST()`  
**Lines**: 30-167

**⚠️ CRITICAL**: This webhook **DOES NOT update the products table**!

```122:146:src/app/api/webhooks/shopify/product-update/route.ts
    // Update pricing_config in database
    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .update({
        current_price: newPrice,
        last_price_change_date: new Date().toISOString(),
        next_price_change_date: nextPriceChangeDate.toISOString(),
      })
      .eq('shopify_product_id', product.id.toString())
      .select();

    if (error) {
      logger.error('Database update failed', error as Error, { webhookId, storeId: store.id });
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      logger.warn(`No pricing config found for product ${product.id}`, { webhookId, storeId: store.id });
      return NextResponse.json({ 
        warning: 'Product not in smart pricing system' 
      });
    }
```

**⚠️ Problem**:
- Webhook receives product update from Shopify
- **Only updates `pricing_config` table**
- **Does NOT update `products` table**
- If product doesn't exist in `products` table, webhook silently fails
- **Does NOT create product record if missing**

### 3.2 Price Update Route

**File**: `src/app/api/shopify/products/[productId]/price/route.ts`  
**Lines**: 85-116

```85:116:src/app/api/shopify/products/[productId]/price/route.ts
      .update({ current_price: price })
      .eq('id', dbProduct.id);

    if (updateError) {
      console.error('Failed to update database:', updateError);
      // Don't fail the request - Shopify was updated successfully
    }

    // Also update variant price if variant exists
    const { data: variant } = await supabaseAdmin
      .from('product_variants')
      .select('id')
      .eq('product_id', dbProduct.id)
      .eq('shopify_id', actualVariantId)
      .single();

    if (variant) {
      const { error: variantUpdateError } = await supabaseAdmin
        .from('product_variants')
        .update({ price: price.toString() })
        .eq('product_id', dbProduct.id)
        .eq('shopify_id', actualVariantId);

      if (variantUpdateError) {
        console.error('Failed to update variant:', variantUpdateError);
      }
    }
```

**✅ Safe**: Only updates existing products, doesn't create new ones

---

## 4. 🎣 Webhook Ingestion

### 4.1 Product Update Webhook (Current)

**File**: `src/app/api/webhooks/shopify/product-update/route.ts`

**Analysis**: 
- ✅ Verifies webhook signature
- ✅ Checks for duplicate processing
- ⚠️ **Does NOT create/update products table**
- ⚠️ **Only updates pricing_config**
- ⚠️ If product doesn't exist in database, webhook is ignored

### 4.2 Product Create Webhook

**⚠️ MISSING**: No webhook handler for `products/create` found in codebase!

**Impact**:
- When product is created in Shopify, no automatic sync to Supabase
- User must manually run sync
- If sync fails, product never appears in database

---

## 5. 🚨 Code Paths Leading to NULL `shopify_id`

### Path 1: Sync with Undefined `product.id`

**Location**: `src/features/shopify-integration/services/syncProducts.ts:147`

```typescript
shopify_id: product.id,  // If product.id is undefined, shopify_id becomes undefined
```

**Scenario**:
1. Shopify API returns product with `id: undefined` (malformed response)
2. `processProductBatch()` maps `shopify_id: undefined`
3. Upsert attempts to insert `shopify_id: undefined`
4. **If database constraint is missing**: NULL inserted
5. **If database constraint exists**: Error thrown, product skipped

**Result**: Product with NULL `shopify_id` in database (if constraint missing)

### Path 2: Legacy Sync Fallback Fails

**Location**: `napoleonshopify3/src/features/shopify-integration/services/syncProducts.ts:81`

```typescript
shopify_id: product.shopifyId ?? product.id,  // If both are undefined, shopify_id is undefined
```

**Scenario**:
1. Product object has neither `shopifyId` nor `id`
2. Fallback evaluates to `undefined`
3. Upsert inserts `shopify_id: undefined`
4. **If database constraint is missing**: NULL inserted

**Result**: Product with NULL `shopify_id` in database

### Path 3: Race Condition During Upsert

**Location**: `src/features/shopify-integration/services/syncProducts.ts:145-165`

**Scenario**:
1. Product object is mapped with `shopify_id: product.id` (valid)
2. Before upsert, `product.id` is mutated to `undefined`
3. Upsert uses mutated value
4. **If database constraint is missing**: NULL inserted

**Result**: Product with NULL `shopify_id` in database

### Path 4: Database Constraint Missing

**Scenario**:
1. Migration not run or failed
2. `shopify_id` column exists but without `NOT NULL` constraint
3. Any of the above paths can insert NULL
4. Database accepts NULL value

**Result**: Product with NULL `shopify_id` in database

### Path 5: Direct Database Manipulation

**Scenario**:
1. SQL script or admin tool directly inserts product
2. `shopify_id` is explicitly set to NULL
3. **If database constraint is missing**: NULL inserted

**Result**: Product with NULL `shopify_id` in database

---

## 6. 🔍 Variant `shopify_product_id` Assignment

### 6.1 Sync Variants

**File**: `src/features/shopify-integration/services/syncProducts.ts`  
**Function**: `processProductVariants()`  
**Lines**: 246-277

```246:277:src/features/shopify-integration/services/syncProducts.ts
  const variantsToUpsert = variants.map(variant => {
    const priceDecimal = parseFloat(variant.price);
    const normalizedPrice = Number.isFinite(priceDecimal) ? priceDecimal : 0;
    variantPriceByShopifyId.set(variant.id, normalizedPrice);

    const isSmartPricingDisabled = smartPricingDisabled.get(variant.id) === true;
    
    // Base data that's always synced
    const baseData = {
      store_id: storeId,
      product_id: productDbId,  // Use internal database UUID
      shopify_id: variant.id,
      shopify_product_id: shopifyProductId,
      title: variant.title,
      price: variant.price.toString(),
      starting_price: normalizedPrice,
      // CRITICAL: Only sync current_price if smart pricing is enabled
      // When disabled, preserve the database value (which should be pre_smart_pricing_price)
      ...(isSmartPricingDisabled ? {} : { current_price: normalizedPrice }),
      compare_at_price: variant.compareAtPrice?.toString() || null,
      sku: variant.sku || null,
      inventory_quantity: variant.inventoryQuantity || 0,
      weight: variant.weight || 0,
      weight_unit: variant.weightUnit || 'kg',
      image_url: variant.image?.src || null,
      created_at: variant.createdAt,
      updated_at: variant.updatedAt,
      is_active: true,
    };
    
    return baseData;
  });
```

**⚠️ Issue**: `shopify_product_id: shopifyProductId`
- If `shopifyProductId` parameter is `undefined`, `shopify_product_id` becomes `undefined`
- **Result**: NULL in database (if constraint allows)

**Called from** (Line 191):
```191:191:src/features/shopify-integration/services/syncProducts.ts
      await processProductVariants(storeId, dbProduct.id, product.variants, product.id);
```

- If `product.id` is `undefined`, `shopifyProductId` parameter is `undefined`
- **Result**: All variants have NULL `shopify_product_id`

---

## 7. 📋 Summary: Where `shopify_id` Could Be NULL

### ✅ Safe Operations (Always Have `shopify_id`)

1. **Test Product Creation** (`napoleonshopify3/src/app/api/test/create-product/route.ts`)
   - Uses synthetic ID: `test-product-${Date.now()}`

### ⚠️ Risky Operations (Could Have NULL `shopify_id`)

1. **Primary Sync** (`src/features/shopify-integration/services/syncProducts.ts:147`)
   - **Risk**: `product.id` could be `undefined`
   - **Mitigation**: Database `NOT NULL` constraint (if present)

2. **Legacy Sync** (`napoleonshopify3/src/features/shopify-integration/services/syncProducts.ts:81`)
   - **Risk**: Both `product.shopifyId` and `product.id` could be `undefined`
   - **Mitigation**: Database `NOT NULL` constraint (if present)

3. **Race Condition** (Any sync operation)
   - **Risk**: Product object mutated before upsert
   - **Mitigation**: Immutable product objects

4. **Database Constraint Missing**
   - **Risk**: Migration not run, constraint missing
   - **Mitigation**: Verify schema constraints

### ❌ Missing Operations (Don't Create Products in Supabase)

1. **Product Creation API** (`src/app/api/shopify/products/route.ts:POST`)
   - Creates in Shopify only
   - **Requires manual sync** to appear in Supabase

2. **Product Update Webhook** (`src/app/api/webhooks/shopify/product-update/route.ts`)
   - Updates `pricing_config` only
   - **Does NOT create/update products table**

3. **Product Create Webhook**
   - **MISSING**: No handler exists
   - Products created in Shopify are not automatically synced

---

## 8. 🎯 Root Cause: Product with NULL `shopify_id`

### Most Likely Scenario

**Path**: Sync with undefined `product.id` + Missing database constraint

1. Shopify API returns malformed product (missing `id`)
2. `processProductBatch()` maps `shopify_id: undefined`
3. Database constraint is missing or bypassed
4. Upsert inserts product with `shopify_id: NULL`
5. Product appears in database with NULL `shopify_id`
6. `useProducts` hook filters it out (line 157)
7. **BUT**: If filter fails or race condition, product appears in UI
8. `ProductCard` receives `product.id = undefined` (from `shopify_id`)
9. Smart pricing toggle fails with "undefined" URL

### Verification Query

```sql
-- Find products with NULL shopify_id
SELECT id, shopify_id, title, store_id, created_at
FROM products
WHERE shopify_id IS NULL;

-- Find products with empty string shopify_id
SELECT id, shopify_id, title, store_id, created_at
FROM products
WHERE shopify_id = '' OR shopify_id = 'null' OR shopify_id = 'undefined';
```

---

## 9. ✅ Recommendations

### Immediate Fixes

1. **Add Validation Before Upsert**:
   ```typescript
   const productsToUpsert = products
     .filter(product => product.id && typeof product.id === 'string' && product.id.length > 0)
     .map(product => ({
       shopify_id: product.id, // Now guaranteed to be valid
       // ... rest of fields
     }));
   ```

2. **Verify Database Constraint**:
   ```sql
   ALTER TABLE products 
   ALTER COLUMN shopify_id SET NOT NULL;
   ```

3. **Add Product Create Webhook Handler**:
   - Automatically sync products when created in Shopify
   - Prevents missing products in database

4. **Add Error Handling**:
   - Log products with missing `shopify_id` during sync
   - Skip them instead of inserting NULL

### Long-term Improvements

1. **Type Safety**: Use TypeScript types to ensure `product.id` is always string
2. **Validation Layer**: Add runtime validation for all Shopify API responses
3. **Monitoring**: Alert when products with NULL `shopify_id` are detected
4. **Data Migration**: Clean up any existing NULL `shopify_id` records

