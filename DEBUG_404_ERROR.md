# Debug 404 Error - Step by Step Guide

Since you're still getting the same 404 error after running the migration, let's systematically check each possible cause.

## Step 1: Verify Migration Ran ✅

**Check if the column exists:**

Run this in Supabase SQL Editor:
```sql
-- Check if shopify_product_id column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'product_variants' 
AND column_name = 'shopify_product_id';
```

**Expected Result**: Should return one row with `column_name: shopify_product_id` and `data_type: text`

**If this fails**: The migration didn't run. Re-run it in Supabase SQL Editor.

---

## Step 2: Check If Variants Have shopify_product_id ✅

**Check if variants are populated:**

```sql
-- Check variant count and shopify_product_id population
SELECT 
  COUNT(*) as total_variants,
  COUNT(shopify_product_id) as variants_with_shopify_product_id,
  COUNT(*) - COUNT(shopify_product_id) as variants_missing_shopify_product_id
FROM product_variants;
```

**Expected Result**: `variants_with_shopify_product_id` should equal `total_variants`

**If `variants_missing_shopify_product_id > 0`**: 
- The migration ran but backfill failed OR
- New variants were synced after migration without shopify_product_id

**Fix**: Re-run the backfill:
```sql
UPDATE product_variants pv
SET shopify_product_id = p.shopify_id
FROM products p
WHERE pv.product_id = p.id
  AND pv.shopify_product_id IS NULL;
```

---

## Step 3: Check What productId Is Being Passed 🔍

**In your browser console**, when you click the smart pricing button, look for:

```
🔍 [ProductCard] Initializing useSmartPricingToggle
```

Check these values:
- `apiProductId`: What ID is being used?
- `dbIdExists`: Is `dbId` present?
- `dbIdIsUUID`: Is `dbId` a valid UUID?
- `usingFallback`: Is it using `product.id` (Shopify ID) instead?

**Possible Scenarios:**

### Scenario A: `apiProductId` is a UUID
- `dbIdExists: true`
- `dbIdIsUUID: true`
- **Expected**: Should query by `product_id` (UUID path)
- **Check**: Look for `🔍 [getVariantsByProductId] Querying by internal UUID (product_id)`

### Scenario B: `apiProductId` is a Shopify ID
- `dbIdExists: false` OR `dbIdIsUUID: false`
- `usingFallback: true`
- **Expected**: Should query by `shopify_product_id` (Shopify ID path)
- **Check**: Look for `🔍 [getVariantsByProductId] Querying variants by shopify_product_id`

---

## Step 4: Check Diagnostic Endpoint Results 🔍

**When you click the button**, check the console for:

```
[DIAGNOSTIC] Results:
```

Look for these key values:

```json
{
  "step1_auth": {
    "hasStore": true/false,  // Should be true
    "storeId": "...",        // Should have a value
  },
  "summary": {
    "productExists": true/false,          // Should be true
    "productInCorrectStore": true/false,  // Should be true
    "variantsExist": true/false,          // Should be true
    "getVariantsFunctionWorks": true/false // This is the key!
  }
}
```

**If `getVariantsFunctionWorks: false`**, check `step6_getVariantsByProductId`:
```json
{
  "step6_getVariantsByProductId": {
    "success": false,
    "error": "...",  // This tells you why it failed!
  }
}
```

---

## Step 5: Check Specific Query Results 🔍

**If productId is a UUID**, check:
```json
{
  "step4_variantsByProductId": {
    "count": 0,  // Should be > 0
    "error": "...",  // Check for errors
  }
}
```

**If productId is a Shopify ID**, check:
```json
{
  "step5_variantsByShopifyProductId": {
    "count": 0,  // Should be > 0
    "error": "...",  // Check for errors - THIS IS KEY!
  }
}
```

---

## Step 6: Verify Store Match 🔍

**Check if variants belong to the correct store:**

```sql
-- Replace YOUR_PRODUCT_ID and YOUR_STORE_ID with actual values from diagnostic
-- Get the values from browser console diagnostic results

-- If productId is a UUID:
SELECT 
  pv.id,
  pv.shopify_id,
  pv.shopify_product_id,
  pv.store_id,
  p.store_id as product_store_id,
  p.shopify_id as product_shopify_id
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.product_id = 'YOUR_PRODUCT_ID'
  AND pv.store_id = 'YOUR_STORE_ID';

-- If productId is a Shopify ID:
SELECT 
  pv.id,
  pv.shopify_id,
  pv.shopify_product_id,
  pv.store_id,
  p.store_id as product_store_id,
  p.shopify_id as product_shopify_id
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.shopify_product_id = 'YOUR_SHOPIFY_PRODUCT_ID'
  AND pv.store_id = 'YOUR_STORE_ID';
```

**Check**:
- Do variants exist?
- Does `pv.store_id` match `YOUR_STORE_ID`?
- Does `pv.shopify_product_id` match `YOUR_SHOPIFY_PRODUCT_ID` (if using Shopify ID)?

---

## Common Issues & Fixes

### Issue 1: Column Doesn't Exist
**Symptoms**: Step 1 check fails  
**Fix**: Run migration in Supabase SQL Editor

### Issue 2: Column Exists But All NULL
**Symptoms**: Step 2 shows `variants_missing_shopify_product_id > 0`  
**Fix**: Run backfill query (see Step 2)

### Issue 3: Wrong productId Format
**Symptoms**: Step 3 shows wrong format  
**Fix**: Check if `dbId` is being set correctly in `useProducts.ts` (line 162)

### Issue 4: Variants Not Synced to Correct Store
**Symptoms**: Step 6 shows variants belong to different store  
**Fix**: Re-sync products

### Issue 5: Variants Don't Have shopify_product_id After Sync
**Symptoms**: Newly synced variants missing `shopify_product_id`  
**Fix**: Check `syncProducts.ts` line 258 - should be inserting `shopify_product_id`

---

## Quick Test Script

**Run this in browser console after clicking the button:**

```javascript
// Get diagnostic data from console
// Look for: [DIAGNOSTIC] Results:

// Or manually call diagnostic endpoint:
const productId = 'YOUR_PRODUCT_ID_HERE'; // From console log
const storeId = localStorage.getItem('selected-store-id');

fetch(`/api/debug/product-diagnosis?productId=${encodeURIComponent(productId)}`, {
  headers: {
    'x-store-id': storeId
  }
})
  .then(res => res.json())
  .then(data => {
    console.log('📊 Full Diagnostic:', JSON.stringify(data.diagnostics, null, 2));
    console.log('✅ Summary:', data.diagnostics.summary);
    console.log('🔍 Step 5 (Shopify ID):', data.diagnostics.step5_variantsByShopifyProductId);
    console.log('🔍 Step 4 (UUID):', data.diagnostics.step4_variantsByProductId);
    console.log('🔍 Step 6 (Actual Function):', data.diagnostics.step6_getVariantsByProductId);
  });
```

---

## What to Report Back

When you've run these checks, report back with:

1. ✅ Step 1 result: Does column exist?
2. ✅ Step 2 result: How many variants missing shopify_product_id?
3. ✅ Step 3 result: What productId format is being used?
4. ✅ Step 4 result: What does diagnostic show?
5. ✅ Step 5 result: Which query is failing?
6. ✅ Step 6 result: Do variants exist for that product/store?

This will help identify the exact issue!

