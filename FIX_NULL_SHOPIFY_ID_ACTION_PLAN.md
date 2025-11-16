# Fix NULL shopify_id - Action Plan

## 🎯 Problem Summary

Products can end up with `shopify_id = NULL` in Supabase when:
1. Shopify API returns products with missing/undefined `id` field
2. No validation before mapping `product.id` to `shopify_id`
3. Database constraint missing or bypassed

**Impact**: Smart pricing toggle fails, products can't be identified, API calls fail with "undefined" URLs

---

## 📋 Priority-Based Action Plan

### 🔴 **PRIORITY 1: Immediate Fixes (Do First)**

#### Step 1.1: Add Validation in ShopifyClient

**File**: `src/features/shopify-integration/services/shopifyClient.ts`  
**Line**: 79

**Current Code**:
```typescript
id: product.id.toString(),  // ⚠️ No validation
```

**Fix**:
```typescript
id: (() => {
  if (!product.id || product.id === null || product.id === undefined) {
    throw new Error(`Product missing ID field. Title: "${product.title || 'Unknown'}"`);
  }
  return product.id.toString();
})(),
```

**OR** (if you want to skip invalid products instead of throwing):
```typescript
id: product.id && product.id !== null && product.id !== undefined
  ? product.id.toString()
  : (() => {
      console.error(`⚠️ Skipping product with missing ID:`, product);
      return null; // Will be filtered out
    })(),
```

**Why**: Prevents `undefined.toString()` errors and catches missing IDs early

---

#### Step 1.2: Add Validation in Sync Function

**File**: `src/features/shopify-integration/services/syncProducts.ts`  
**Line**: 145-157

**Current Code**:
```typescript
const productsToUpsert = products.map(product => ({
  store_id: storeId,
  shopify_id: product.id,  // ⚠️ No validation
  // ...
}));
```

**Fix**:
```typescript
// Filter out products with invalid IDs BEFORE mapping
const validProducts = products.filter(product => {
  if (!product.id || typeof product.id !== 'string' || product.id.length === 0) {
    console.error(`⚠️ Skipping product with invalid ID:`, {
      title: product.title,
      id: product.id,
      idType: typeof product.id,
    });
    return false;
  }
  return true;
});

if (validProducts.length < products.length) {
  const skippedCount = products.length - validProducts.length;
  console.warn(`⚠️ Skipped ${skippedCount} product(s) with invalid IDs`);
}

const productsToUpsert = validProducts.map(product => ({
  store_id: storeId,
  shopify_id: product.id,  // ✅ Now guaranteed to be valid
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

**Why**: Prevents NULL `shopify_id` from being inserted into database

---

#### Step 1.3: Add Database Constraint

**File**: Create new migration or add to existing

**SQL**:
```sql
-- Ensure shopify_id is NOT NULL
ALTER TABLE products 
ALTER COLUMN shopify_id SET NOT NULL;

-- Add check constraint to prevent empty strings
ALTER TABLE products
ADD CONSTRAINT shopify_id_not_empty 
CHECK (shopify_id IS NOT NULL AND shopify_id != '');

-- Verify constraint exists
SELECT 
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'products' 
  AND column_name = 'shopify_id';
```

**Expected Result**: `is_nullable = 'NO'`

**Why**: Database-level protection against NULL values

---

### 🟡 **PRIORITY 2: Error Handling & Logging**

#### Step 2.1: Add Error Tracking

**File**: `src/features/shopify-integration/services/syncProducts.ts`  
**Location**: After filtering invalid products

**Add**:
```typescript
// Track invalid products for reporting
const invalidProducts: Array<{ title: string; reason: string }> = [];

const validProducts = products.filter(product => {
  if (!product.id) {
    invalidProducts.push({
      title: product.title || 'Unknown',
      reason: 'Missing ID field'
    });
    return false;
  }
  
  if (typeof product.id !== 'string') {
    invalidProducts.push({
      title: product.title || 'Unknown',
      reason: `Invalid ID type: ${typeof product.id}`
    });
    return false;
  }
  
  if (product.id.length === 0) {
    invalidProducts.push({
      title: product.title || 'Unknown',
      reason: 'Empty ID string'
    });
    return false;
  }
  
  return true;
});

// Log invalid products
if (invalidProducts.length > 0) {
  console.error(`❌ Found ${invalidProducts.length} products with invalid IDs:`, invalidProducts);
  // Optionally: Store in error_logs table for monitoring
}
```

**Why**: Better visibility into data quality issues

---

#### Step 2.2: Update Sync Result Interface

**File**: `src/features/shopify-integration/services/syncProducts.ts`  
**Location**: `SyncResult` interface

**Current**:
```typescript
export interface SyncResult {
  success: boolean;
  totalProducts: number;
  syncedProducts: number;
  duration: number;
  errors: string[];
}
```

**Update**:
```typescript
export interface SyncResult {
  success: boolean;
  totalProducts: number;
  syncedProducts: number;
  skippedProducts: number;  // ✅ NEW: Products skipped due to invalid IDs
  duration: number;
  errors: string[];
  invalidProducts?: Array<{ title: string; reason: string }>;  // ✅ NEW: Details
}
```

**Why**: Better reporting to users about sync issues

---

### 🟢 **PRIORITY 3: Data Cleanup**

#### Step 3.1: Find Existing NULL shopify_id Records

**SQL Query**:
```sql
-- Find products with NULL shopify_id
SELECT 
  id,
  shopify_id,
  title,
  store_id,
  created_at,
  updated_at
FROM products
WHERE shopify_id IS NULL 
   OR shopify_id = '' 
   OR shopify_id = 'null' 
   OR shopify_id = 'undefined';
```

**Action**: 
- Review these records
- Determine if they should be deleted or fixed
- If fixable, re-sync from Shopify

---

#### Step 3.2: Cleanup Script

**File**: Create `scripts/cleanup-null-shopify-id.ts` (or SQL script)

**SQL Option**:
```sql
-- Option 1: Delete products with NULL shopify_id (if they're invalid)
DELETE FROM products
WHERE shopify_id IS NULL 
   OR shopify_id = '' 
   OR shopify_id = 'null' 
   OR shopify_id = 'undefined';

-- Option 2: Mark as inactive instead of deleting
UPDATE products
SET is_active = false
WHERE shopify_id IS NULL 
   OR shopify_id = '' 
   OR shopify_id = 'null' 
   OR shopify_id = 'undefined';
```

**TypeScript Option** (if you want to re-sync):
```typescript
// Find products with NULL shopify_id
const { data: invalidProducts } = await supabase
  .from('products')
  .select('id, title, store_id')
  .or('shopify_id.is.null,shopify_id.eq.,shopify_id.eq.null,shopify_id.eq.undefined');

// For each store, trigger a re-sync
const storeIds = [...new Set(invalidProducts.map(p => p.store_id))];
for (const storeId of storeIds) {
  // Trigger sync to re-fetch from Shopify
  await syncProductsFromShopify(storeId, shopDomain, accessToken);
}
```

**Why**: Clean up existing bad data

---

### 🔵 **PRIORITY 4: Long-term Improvements**

#### Step 4.1: Add Type Safety

**File**: `src/features/shopify-integration/types/index.ts`

**Current**:
```typescript
export interface ShopifyProduct {
  id: string;  // ⚠️ No guarantee it's not undefined
  // ...
}
```

**Update**:
```typescript
export interface ShopifyProduct {
  id: string;  // Required, non-empty string
  // ...
}

// Add validation function
export function isValidShopifyProduct(product: unknown): product is ShopifyProduct {
  if (!product || typeof product !== 'object') return false;
  const p = product as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    typeof p.title === 'string'
  );
}
```

**Usage**:
```typescript
const validProducts = shopifyProducts.filter(isValidShopifyProduct);
```

**Why**: Type-safe validation at compile time

---

#### Step 4.2: Add Monitoring/Alerting

**File**: Create `src/features/shopify-integration/services/monitorSyncHealth.ts`

**Code**:
```typescript
export async function checkSyncHealth(storeId: string): Promise<{
  hasNullIds: boolean;
  nullIdCount: number;
  invalidIdCount: number;
}> {
  const supabase = createAdminClient();
  
  // Check for NULL shopify_id
  const { data: nullIds, count: nullIdCount } = await supabase
    .from('products')
    .select('id', { count: 'exact' })
    .eq('store_id', storeId)
    .is('shopify_id', null);
  
  // Check for invalid shopify_id (empty, 'null', 'undefined')
  const { data: invalidIds, count: invalidIdCount } = await supabase
    .from('products')
    .select('id', { count: 'exact' })
    .eq('store_id', storeId)
    .or('shopify_id.eq.,shopify_id.eq.null,shopify_id.eq.undefined');
  
  return {
    hasNullIds: (nullIdCount || 0) > 0,
    nullIdCount: nullIdCount || 0,
    invalidIdCount: invalidIdCount || 0,
  };
}
```

**Why**: Proactive monitoring of data quality

---

#### Step 4.3: Add Product Create Webhook Handler

**File**: Create `src/app/api/webhooks/shopify/product-create/route.ts`

**Code**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    // Verify webhook (same as product-update)
    const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const hmac = request.headers.get('x-shopify-hmac-sha256');
    const hash = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body, 'utf8')
      .digest('base64');

    if (hash !== hmac) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse product data
    const product = JSON.parse(body);
    
    // Validate product ID
    if (!product.id || typeof product.id !== 'number') {
      logger.error('Product create webhook: Missing or invalid ID', { product });
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const storeDomain = request.headers.get('x-shopify-shop-domain');
    if (!storeDomain) {
      return NextResponse.json({ error: 'Missing store domain' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    
    // Get store ID
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('shop_domain', storeDomain)
      .single();

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Insert product with validation
    const { error } = await supabaseAdmin
      .from('products')
      .upsert({
        store_id: store.id,
        shopify_id: product.id.toString(),  // ✅ Validated above
        title: product.title,
        handle: product.handle,
        vendor: product.vendor || null,
        product_type: product.product_type || null,
        tags: product.tags ? product.tags.split(',').map((t: string) => t.trim()) : [],
        status: product.status,
        created_at: product.created_at,
        updated_at: product.updated_at,
        is_active: true,
      }, {
        onConflict: 'store_id,shopify_id',
      });

    if (error) {
      logger.error('Failed to create product from webhook', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Webhook processing error', error as Error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**Why**: Automatic sync when products are created in Shopify

---

## 📝 Implementation Checklist

### Phase 1: Immediate Fixes (Do Today)

- [ ] **Step 1.1**: Add validation in `shopifyClient.ts:79`
  - [ ] Test with missing ID
  - [ ] Test with null ID
  - [ ] Test with valid ID
  
- [ ] **Step 1.2**: Add validation in `syncProducts.ts:145-157`
  - [ ] Filter invalid products
  - [ ] Log skipped products
  - [ ] Test sync with invalid products
  
- [ ] **Step 1.3**: Add database constraint
  - [ ] Create migration
  - [ ] Run migration
  - [ ] Verify constraint exists
  - [ ] Test: Try to insert NULL (should fail)

### Phase 2: Error Handling (This Week)

- [ ] **Step 2.1**: Add error tracking
  - [ ] Track invalid products
  - [ ] Log to console
  - [ ] Optionally store in database
  
- [ ] **Step 2.2**: Update SyncResult interface
  - [ ] Add `skippedProducts` field
  - [ ] Add `invalidProducts` array
  - [ ] Update UI to show skipped products

### Phase 3: Data Cleanup (This Week)

- [ ] **Step 3.1**: Find existing NULL records
  - [ ] Run SQL query
  - [ ] Document findings
  - [ ] Decide: delete or fix
  
- [ ] **Step 3.2**: Run cleanup script
  - [ ] Delete or mark inactive
  - [ ] Verify cleanup
  - [ ] Re-sync if needed

### Phase 4: Long-term (Next Sprint)

- [ ] **Step 4.1**: Add type safety
  - [ ] Create validation function
  - [ ] Use in sync functions
  - [ ] Add TypeScript types
  
- [ ] **Step 4.2**: Add monitoring
  - [ ] Create health check function
  - [ ] Add to admin dashboard
  - [ ] Set up alerts
  
- [ ] **Step 4.3**: Add product create webhook
  - [ ] Create webhook handler
  - [ ] Register webhook in Shopify
  - [ ] Test webhook

---

## 🧪 Testing Plan

### Test 1: Missing ID in Shopify API Response

**Setup**: Mock Shopify API to return product without `id`

**Expected**: 
- Product is skipped (not inserted)
- Error logged
- Sync continues with other products

**Test Code**:
```typescript
// Mock ShopifyClient.getProducts() to return product without ID
const mockProducts = [{
  title: "Test Product",
  // id missing
  variants: [...]
}];

// Run sync
const result = await syncProductsFromShopify(storeId, shopDomain, accessToken);

// Assert
expect(result.skippedProducts).toBe(1);
expect(result.invalidProducts).toHaveLength(1);
```

---

### Test 2: Null ID in Shopify API Response

**Setup**: Mock Shopify API to return product with `id: null`

**Expected**:
- Product is skipped
- Error logged
- Database constraint prevents NULL insertion

---

### Test 3: Valid Products Still Sync

**Setup**: Normal sync with valid products

**Expected**:
- All valid products sync successfully
- No products skipped
- All have non-null `shopify_id`

---

### Test 4: Database Constraint Enforcement

**Setup**: Try to insert product with NULL `shopify_id`

**Expected**:
- Database rejects insert
- Error returned
- No NULL values in database

---

## 🚀 Quick Start (Minimal Fix)

If you need a **quick fix right now**, do these 3 things:

1. **Add filter in syncProducts.ts** (5 minutes):
```typescript
const validProducts = products.filter(p => p.id && typeof p.id === 'string' && p.id.length > 0);
const productsToUpsert = validProducts.map(product => ({
  shopify_id: product.id, // ✅ Now safe
  // ...
}));
```

2. **Add database constraint** (2 minutes):
```sql
ALTER TABLE products ALTER COLUMN shopify_id SET NOT NULL;
```

3. **Clean up existing NULLs** (5 minutes):
```sql
DELETE FROM products WHERE shopify_id IS NULL;
```

**Total Time**: ~12 minutes for basic protection

---

## 📊 Success Metrics

After implementing fixes, verify:

- [ ] **Zero new NULL shopify_id records** created
- [ ] **All existing NULL records** cleaned up
- [ ] **Sync errors logged** when products have invalid IDs
- [ ] **Database constraint** prevents NULL inserts
- [ ] **Smart pricing toggle** works for all products
- [ ] **No "undefined" URLs** in API calls

---

## 🔍 Verification Queries

After implementation, run these to verify:

```sql
-- Should return 0 rows
SELECT COUNT(*) FROM products WHERE shopify_id IS NULL;

-- Should return 0 rows
SELECT COUNT(*) FROM products WHERE shopify_id = '';

-- Should return 0 rows
SELECT COUNT(*) FROM products WHERE shopify_id = 'undefined';

-- Verify constraint exists
SELECT is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'shopify_id';
-- Expected: 'NO'
```

---

## 📚 Related Files to Update

1. `src/features/shopify-integration/services/shopifyClient.ts` - Add validation
2. `src/features/shopify-integration/services/syncProducts.ts` - Add filtering
3. `supabase/migrations/XXX_add_shopify_id_constraint.sql` - New migration
4. `src/features/shopify-integration/types/index.ts` - Add validation types
5. `src/app/api/webhooks/shopify/product-create/route.ts` - New webhook handler (optional)

---

## 🎯 Expected Outcome

After completing this plan:

✅ **No new products with NULL shopify_id**  
✅ **Existing NULL records cleaned up**  
✅ **Better error visibility**  
✅ **Automatic sync on product creation**  
✅ **Type-safe validation**  
✅ **Proactive monitoring**

The smart pricing toggle will work reliably for all products, and you'll have visibility into any data quality issues.

