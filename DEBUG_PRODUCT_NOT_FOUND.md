# Debugging "Product not found for this store" Error

## Error Location
This error is thrown by `getVariantsByProductId()` in `src/shared/lib/variantHelpers.ts` when no variants are found matching both the `productId` and `storeId`.

## Possible Causes

### 1. **Store ID Mismatch** ⚠️ MOST COMMON
**Problem**: The product/variants belong to a different store than the authenticated user's store.

**How to check:**
```sql
-- Check which store the product belongs to
SELECT p.id, p.shopify_id, p.title, p.store_id, s.name as store_name
FROM products p
LEFT JOIN stores s ON p.store_id = s.id
WHERE p.id = 'YOUR_PRODUCT_ID' OR p.shopify_id = 'YOUR_SHOPIFY_ID';

-- Check variants
SELECT v.id, v.product_id, v.store_id, v.shopify_id, v.shopify_product_id
FROM product_variants v
WHERE v.product_id = 'YOUR_PRODUCT_ID' OR v.shopify_product_id = 'YOUR_SHOPIFY_ID';
```

**Solution:**
- Verify the user is authenticated with the correct store
- Check if product was synced to wrong store
- Re-sync products to ensure they're in the correct store

---

### 2. **Product Not Synced to Database**
**Problem**: Product exists in Shopify but hasn't been synced to your database yet.

**How to check:**
```sql
-- Check if product exists
SELECT * FROM products 
WHERE shopify_id = 'YOUR_SHOPIFY_ID' 
  AND store_id = 'YOUR_STORE_ID';

-- Should return at least one row
```

**Solution:**
- Run a full product sync from the products page
- Ensure the sync completes successfully
- Refresh the page after sync

---

### 3. **Variants Not Synced**
**Problem**: Product exists in `products` table but has no variants in `product_variants` table.

**How to check:**
```sql
-- Check if variants exist for the product
SELECT COUNT(*) as variant_count
FROM product_variants
WHERE product_id = 'YOUR_PRODUCT_ID' 
  AND store_id = 'YOUR_STORE_ID';

-- Should return > 0
```

**Solution:**
- Run a full product sync (variants are synced with products)
- Check sync logs for errors
- Verify variants exist in Shopify

---

### 4. **Wrong ProductId Format**
**Problem**: Using Shopify ID when UUID is expected, or vice versa.

**How to check:**
- UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (36 chars with hyphens)
- Shopify ID: Usually numeric string like `123456789`

**In console logs, check:**
```
🔍 [getVariantsByProductId] Called with:
  - productId: <check this value>
  - isUUID: <true/false>
  - storeId: <check this matches>
```

**Solution:**
- If using UUID but product was synced with Shopify ID, use Shopify ID
- If using Shopify ID but query expects UUID, look up the UUID first
- The function handles both, but the ID must match what's in the database

---

### 5. **Product Deleted from Database**
**Problem**: Product was deleted from database but still showing in UI (stale cache).

**How to check:**
```sql
-- Check if product exists
SELECT * FROM products WHERE id = 'YOUR_PRODUCT_ID';
-- If no rows, product was deleted
```

**Solution:**
- Refresh the products list
- Clear React Query cache
- Re-sync products

---

### 6. **Store Authentication Issue**
**Problem**: User is authenticated but `requireStore()` returns wrong store ID.

**How to check:**
- Check API logs for: `🔷 Store ID: <value>`
- Verify this matches the product's `store_id` in database
- Check if user has multiple stores and wrong one is selected

**Solution:**
- Verify store selection in UI
- Check `requireStore()` implementation
- Ensure user's default store is correct

---

### 7. **Data Inconsistency**
**Problem**: Product exists but variants have wrong `store_id` or `product_id`.

**How to check:**
```sql
-- Check for orphaned variants
SELECT v.*, p.store_id as product_store_id
FROM product_variants v
LEFT JOIN products p ON v.product_id = p.id
WHERE v.product_id = 'YOUR_PRODUCT_ID'
  AND (v.store_id != p.store_id OR p.store_id IS NULL);
```

**Solution:**
- Re-sync products to fix data consistency
- Manually fix variant `store_id` if needed
- Check sync process for bugs

---

### 8. **ProductId is Shopify ID but shopify_product_id is NULL**
**Problem**: When using Shopify ID, variants must have `shopify_product_id` set, but it's NULL.

**How to check:**
```sql
-- Check if shopify_product_id is set
SELECT v.id, v.shopify_product_id, v.shopify_id
FROM product_variants v
WHERE v.shopify_product_id = 'YOUR_SHOPIFY_ID'
  AND v.store_id = 'YOUR_STORE_ID';
```

**Solution:**
- Run full product sync (this should populate `shopify_product_id`)
- Check sync logs for errors
- Verify variants have `shopify_product_id` in database

---

## Debugging Steps

### Step 1: Check Console Logs
Look for these logs in your server console:
```
🔍 [getVariantsByProductId] Called with:
  productId: <value>
  storeId: <value>
  isUUID: <true/false>
```

### Step 2: Check Database Directly
Run these queries to verify data exists:
```sql
-- For UUID productId
SELECT * FROM product_variants 
WHERE product_id = 'YOUR_PRODUCT_ID' 
  AND store_id = 'YOUR_STORE_ID';

-- For Shopify ID productId  
SELECT * FROM product_variants 
WHERE shopify_product_id = 'YOUR_SHOPIFY_ID' 
  AND store_id = 'YOUR_STORE_ID';
```

### Step 3: Check API Response
Look at the API response in Network tab:
- Status code (should be 404 if product not found)
- Response body with `debug` object
- Check `storeId` in debug info

### Step 4: Verify Store Authentication
Check that the authenticated store matches:
```sql
-- Get user's stores
SELECT s.id, s.name, s.shop_domain
FROM stores s
JOIN users u ON s.user_id = u.id
WHERE u.auth_user_id = 'YOUR_AUTH_USER_ID';
```

---

## Quick Fixes

1. **Re-sync Products**: Most common fix - run full product sync
2. **Check Store Selection**: Ensure correct store is selected in UI
3. **Clear Cache**: Refresh page, clear React Query cache
4. **Verify Authentication**: Check user is logged in with correct store
5. **Check Database**: Verify product and variants exist with correct store_id

---

## Prevention

- Always sync products after connecting a new store
- Verify store_id matches between products and variants
- Use consistent ID format (prefer UUID/dbId when available)
- Add validation to prevent products from wrong store being displayed
- Log store_id in all product queries for debugging

