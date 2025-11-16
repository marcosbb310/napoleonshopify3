# Systematic Debugging Test Guide

This guide walks through testing each issue from the systematic debugging document.

## Prerequisites

1. Open your browser's Developer Console (F12 → Console tab)
2. Navigate to the Products page
3. Have a product ID ready (you can get it from the products list)

## Testing Method

Each test should:
1. Click a product button (toggle smart pricing)
2. Check browser console for diagnostic logs
3. Review the diagnostic results
4. Verify the fix worked

---

## ✅ Issue 1: Missing x-store-id Header

**Status**: FIXED

**Test**: 
1. Click any product button
2. Check console for: `📤 API call with store:`
3. Verify it shows: `'x-store-id': '<store-id>'` in the headers

**Expected Result**: Header is present in all API calls

---

## ⏳ Issue 2: Store Not Selected/Loading

**Status**: Check Required

**Test**:
1. Check console for: `🔍 Store selection check:`
2. Verify: `saved` shows a valid store ID
3. Verify: `availableStores` shows at least one store
4. If you see: `❌ No store selected for API call` → Issue 2 confirmed

**How to Fix**:
- Ensure user has at least one store connected
- Check localStorage: `localStorage.getItem('selected-store-id')`
- Verify store is active in database

**Test Command**:
```javascript
// In browser console:
localStorage.getItem('selected-store-id')
```

---

## ⏳ Issue 3: Product Doesn't Exist in Database

**Status**: Check Required

**Test**:
1. Click a product button
2. Check console for: `[DIAGNOSTIC] Results:`
3. Look for: `step2_productByUuid.found` or `step3_productByShopifyId.found`
4. If both are `false` → Issue 3 confirmed

**How to Fix**:
- Run a full product sync from the products page
- Verify product exists in Shopify
- Check sync logs for errors

**Test Command** (Manual):
```bash
# Use the diagnostic endpoint directly:
curl "http://localhost:3000/api/debug/product-diagnosis?productId=YOUR_PRODUCT_ID" \
  -H "x-store-id: YOUR_STORE_ID" \
  -H "Cookie: YOUR_SESSION_COOKIE"
```

---

## ⏳ Issue 4: Product in Wrong Store

**Status**: Check Required

**Test**:
1. Check diagnostic results: `summary.productInCorrectStore`
2. Should be `true`
3. Compare: `step2_productByUuid.product.store_id` with `step1_auth.storeId`
4. If they don't match → Issue 4 confirmed

**How to Fix**:
- If product belongs to different store:
  - Switch to the correct store
  - Or re-sync product to correct store
- Check if product was synced to wrong store during initial sync

**SQL Check**:
```sql
SELECT p.id, p.shopify_id, p.title, p.store_id, s.name as store_name
FROM products p
LEFT JOIN stores s ON p.store_id = s.id
WHERE p.id = 'YOUR_PRODUCT_ID' OR p.shopify_id = 'YOUR_SHOPIFY_ID';
```

---

## ⏳ Issue 5: No Variants for Product

**Status**: Check Required

**Test**:
1. Check diagnostic: `summary.variantsExist`
2. Should be `true`
3. Check: `step4_variantsByProductId.count` or `step5_variantsByShopifyProductId.count`
4. Should be > 0
5. If `variantsExist: false` → Issue 5 confirmed

**How to Fix**:
- Run full product sync (variants sync with products)
- Verify product has variants in Shopify
- Check if variants sync failed during product sync

**SQL Check**:
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

---

## ⏳ Issue 6: Variants Have Wrong store_id

**Status**: Check Required

**Test**:
1. Check diagnostic variant data: `step4_variantsByProductId.variants[].store_id`
2. Should match: `step1_auth.storeId`
3. If they don't match → Issue 6 confirmed

**How to Fix**:
- Re-sync products to fix data consistency
- Manually update variant `store_id` if needed (not recommended)

**SQL Check**:
```sql
SELECT * FROM product_variants 
WHERE product_id = 'YOUR_PRODUCT_ID' 
  AND store_id != 'YOUR_STORE_ID';
```

---

## ⏳ Issue 7: Wrong productId Format

**Status**: Check Required

**Test**:
1. Check diagnostic: `isUUID`
2. `true` = UUID (internal database ID)
3. `false` = Shopify ID (numeric string)
4. Check which ID format is being used

**How to Fix**:
- Use the correct ID format:
  - UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (36 chars)
  - Shopify ID: Usually numeric string
- The function handles both, but must match what's in database

**Note**: The diagnostic endpoint accepts both formats and will try both.

---

## ⏳ Issue 8: Missing shopify_product_id in Variants

**Status**: Check Required

**Test**:
1. Check diagnostic: `step4_variantsByProductId.variants[].hasShopifyProductId`
2. All variants should have `hasShopifyProductId: true`
3. If any are `false` → Issue 8 confirmed

**How to Fix**:
- Run full product sync (should populate `shopify_product_id`)
- Check sync logs for errors
- Verify variants have `shopify_product_id` in database

**SQL Check**:
```sql
SELECT * FROM product_variants 
WHERE product_id = 'YOUR_PRODUCT_ID' 
  AND shopify_product_id IS NULL;
```

---

## ⏳ Issue 9: Product Deleted but Still in Cache

**Status**: Check Required

**Test**:
1. Check diagnostic: `summary.productExists`
2. Should be `true`
3. If product shows in UI but diagnostic says `productExists: false` → Issue 9 confirmed

**How to Fix**:
- Refresh products list
- Clear React Query cache
- Re-sync products

**Test Command** (In Browser Console):
```javascript
// Clear React Query cache
window.__REACT_QUERY_CLIENT__.clear()
// Then refresh page
```

---

## Complete Testing Checklist

Run through each issue and verify:

- [ ] Issue 1: x-store-id header present ✓
- [ ] Issue 2: Store selected and not loading
- [ ] Issue 3: Product exists in database
- [ ] Issue 4: Product in correct store
- [ ] Issue 5: Variants exist for product
- [ ] Issue 6: Variants have correct store_id
- [ ] Issue 7: ProductId format is correct
- [ ] Issue 8: Variants have shopify_product_id
- [ ] Issue 9: Cache is up to date

---

## Quick Test Script

Run this in your browser console to get a full diagnostic for a product:

```javascript
// Replace with your actual product ID
const productId = 'YOUR_PRODUCT_ID_HERE';

// Get the store ID from localStorage
const storeId = localStorage.getItem('selected-store-id');

// Make diagnostic request
fetch(`/api/debug/product-diagnosis?productId=${encodeURIComponent(productId)}`, {
  headers: {
    'x-store-id': storeId
  }
})
  .then(res => res.json())
  .then(data => {
    console.log('📊 Full Diagnostic Results:', JSON.stringify(data.diagnostics, null, 2));
    console.log('✅ Summary:', data.diagnostics.summary);
    
    // Check each issue
    console.log('\n🔍 Issue Check:');
    console.log('Issue 2 (Store):', data.diagnostics.step1_auth.hasStore ? '✅' : '❌');
    console.log('Issue 3 (Product Exists):', data.diagnostics.summary.productExists ? '✅' : '❌');
    console.log('Issue 4 (Correct Store):', data.diagnostics.summary.productInCorrectStore ? '✅' : '❌');
    console.log('Issue 5 (Variants Exist):', data.diagnostics.summary.variantsExist ? '✅' : '❌');
    console.log('Issue 6 (Get Variants Works):', data.diagnostics.summary.getVariantsFunctionWorks ? '✅' : '❌');
  })
  .catch(err => console.error('Error:', err));
```

---

## Next Steps

1. **Test Issue 2** - Verify store selection
2. **If Issue 2 passes** - Test Issue 3
3. **If Issue 3 passes** - Test Issue 4
4. **Continue through all issues** until you find the failing one
5. **Fix the failing issue** and retest
6. **Once all pass** - The error should be resolved

