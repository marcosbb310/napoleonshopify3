# Systematic Debugging: "Product not found for this store"

## Overview
This document provides a methodical approach to debug and fix the "Product not found for this store" error.

## Diagnostic Tool
A diagnostic API endpoint has been created at `/api/debug/product-diagnosis?productId=YOUR_PRODUCT_ID`

This endpoint checks all possible causes automatically.

## All Possible Causes (Checklist)

### ✅ Issue 1: Missing x-store-id Header
**Status**: FIXED
- **Problem**: API calls weren't sending the required `x-store-id` header
- **Fix Applied**: Updated all mutations to use `useAuthenticatedFetch()` which adds the header
- **Test**: Check browser console for `📤 API call with store:` log - should show `x-store-id` header

### ⏳ Issue 2: Store Not Selected/Loading
**How to Check**:
1. Open browser console
2. Look for: `❌ No store selected for API call` or `⚠️ Store is still loading`
3. Check: `useCurrentStore()` returns a valid store

**Fix**:
- Ensure user has at least one store connected
- Check localStorage for `selected-store-id`
- Verify store is active in database

### ⏳ Issue 3: Product Doesn't Exist in Database
**How to Check**:
1. Call diagnostic endpoint: `/api/debug/product-diagnosis?productId=YOUR_ID`
2. Check `step2_productByUuid` or `step3_productByShopifyId` - should show `found: true`

**Fix**:
- Run a full product sync from the products page
- Verify product exists in Shopify
- Check sync logs for errors

### ⏳ Issue 4: Product in Wrong Store
**How to Check**:
1. Diagnostic endpoint: Check `summary.productInCorrectStore` - should be `true`
2. Compare `step2_productByUuid.product.store_id` with `step1_auth.storeId`

**Fix**:
- If product belongs to different store:
  - Either switch to the correct store
  - Or re-sync product to correct store
- Check if product was synced to wrong store during initial sync

### ⏳ Issue 5: No Variants for Product
**How to Check**:
1. Diagnostic endpoint: Check `summary.variantsExist` - should be `true`
2. Check `step4_variantsByProductId.count` or `step5_variantsByShopifyProductId.count` - should be > 0

**Fix**:
- Run full product sync (variants sync with products)
- Verify product has variants in Shopify
- Check if variants sync failed during product sync

### ⏳ Issue 6: Variants Have Wrong store_id
**How to Check**:
1. Diagnostic endpoint: Check variant `store_id` matches authenticated store
2. SQL: `SELECT * FROM product_variants WHERE product_id = 'YOUR_ID' AND store_id != 'STORE_ID'`

**Fix**:
- Re-sync products to fix data consistency
- Manually update variant `store_id` if needed (not recommended)

### ⏳ Issue 7: Wrong productId Format
**How to Check**:
1. Diagnostic endpoint: Check `isUUID` - true means UUID, false means Shopify ID
2. Check if using UUID but product was synced with Shopify ID (or vice versa)

**Fix**:
- Use the correct ID format:
  - UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (36 chars)
  - Shopify ID: Usually numeric string
- The function handles both, but must match what's in database

### ⏳ Issue 8: Missing shopify_product_id in Variants
**How to Check**:
1. Diagnostic endpoint: Check `step5_variantsByShopifyProductId.count` - if 0, check `step4_variantsByProductId.variants[].hasShopifyProductId`
2. SQL: `SELECT * FROM product_variants WHERE shopify_product_id IS NULL`

**Fix**:
- Run full product sync (should populate `shopify_product_id`)
- Check sync logs for errors
- Verify variants have `shopify_product_id` in database

### ⏳ Issue 9: Product Deleted but Still in Cache
**How to Check**:
1. Diagnostic endpoint: Check `summary.productExists` - should be `true`
2. Check if product shows in UI but not in database

**Fix**:
- Refresh products list
- Clear React Query cache
- Re-sync products

## Step-by-Step Debugging Process

### Step 1: Run Diagnostic
```javascript
// In browser console, after clicking a product button:
// The diagnostic will run automatically and log results
// Look for: [DIAGNOSTIC] Results: {...}
```

### Step 2: Check Console Logs
Look for these logs in order:
1. `📤 API call with store:` - Should show storeId
2. `[DIAGNOSTIC] Running product diagnosis...` - Diagnostic started
3. `[DIAGNOSTIC] Results:` - Full diagnostic output
4. `[DEBUG] Response status:` - API response

### Step 3: Identify the Issue
Based on diagnostic results:
- If `step1_auth.hasStore === false` → Issue 2 (Store not selected)
- If `summary.productExists === false` → Issue 3 (Product doesn't exist)
- If `summary.productInCorrectStore === false` → Issue 4 (Wrong store)
- If `summary.variantsExist === false` → Issue 5 (No variants)
- If `summary.getVariantsFunctionWorks === false` → Check step6 error message

### Step 4: Apply Fix
Follow the fix instructions for the identified issue.

### Step 5: Test
1. Clear browser cache
2. Refresh page
3. Try clicking the button again
4. Check console logs
5. Verify diagnostic shows all checks passing

## SQL Queries for Manual Verification

### Check Product Exists
```sql
-- By UUID
SELECT * FROM products WHERE id = 'YOUR_PRODUCT_ID';

-- By Shopify ID
SELECT * FROM products WHERE shopify_id = 'YOUR_SHOPIFY_ID';
```

### Check Product Store
```sql
SELECT p.id, p.shopify_id, p.title, p.store_id, s.name as store_name
FROM products p
LEFT JOIN stores s ON p.store_id = s.id
WHERE p.id = 'YOUR_PRODUCT_ID' OR p.shopify_id = 'YOUR_SHOPIFY_ID';
```

### Check Variants
```sql
-- By product_id (UUID)
SELECT * FROM product_variants 
WHERE product_id = 'YOUR_PRODUCT_ID' 
  AND store_id = 'YOUR_STORE_ID';

-- By shopify_product_id
SELECT * FROM product_variants 
WHERE shopify_product_id = 'YOUR_SHOPIFY_ID' 
  AND store_id = 'YOUR_STORE_ID';
```

### Check Store Ownership
```sql
SELECT s.id, s.name, s.shop_domain, u.id as user_id
FROM stores s
JOIN users u ON s.user_id = u.id
WHERE s.id = 'YOUR_STORE_ID';
```

## Testing Checklist

After each fix, verify:
- [ ] Diagnostic endpoint returns success
- [ ] `summary.productExists === true`
- [ ] `summary.productInCorrectStore === true`
- [ ] `summary.variantsExist === true`
- [ ] `summary.getVariantsFunctionWorks === true`
- [ ] API call succeeds (status 200)
- [ ] Button works in UI

## Next Steps

1. **Test the diagnostic endpoint** - Click a product button and check console
2. **Identify the specific issue** - Use diagnostic results
3. **Apply the fix** - Follow fix instructions
4. **Re-test** - Verify fix worked
5. **Move to next issue** - If still failing, check next item in list

