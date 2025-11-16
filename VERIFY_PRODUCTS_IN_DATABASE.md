# Verify Products Are in Database

## Quick Check - Run This First

**In Supabase SQL Editor**, run this to check if products exist:

```sql
-- 1. Check if ANY products exist
SELECT 
  COUNT(*) as total_products,
  COUNT(DISTINCT store_id) as stores_with_products
FROM products;

-- 2. If products exist, check for your store
-- Get store_id from browser: localStorage.getItem('selected-store-id')
SELECT 
  COUNT(*) as products_for_store,
  MIN(created_at) as oldest_product,
  MAX(created_at) as newest_product
FROM products
WHERE store_id = 'YOUR_STORE_ID_HERE';

-- 3. Sample products to verify structure
SELECT 
  id as dbId,  -- This IS the dbId (UUID)
  shopify_id,  -- Shopify ID (string)
  title,
  store_id,
  created_at
FROM products
WHERE store_id = 'YOUR_STORE_ID_HERE'
ORDER BY created_at DESC
LIMIT 5;
```

## What the Results Mean

### If `total_products = 0`
**Problem**: No products in database at all  
**Fix**: Run a product sync from products page

### If `products_for_store = 0` but `total_products > 0`
**Problem**: Products exist but not for your store  
**Fix**: Check if you're using the correct store_id, or sync products for this store

### If products exist but lookup fails
**Problem**: Shopify IDs don't match OR store_id doesn't match  
**Check**: Compare Shopify IDs from API vs database

## Check Server Logs

**When you load products page**, check your server logs (terminal running `npm run dev`) for:

```
🔍 [API] Looking up dbIds for products:
📊 [API] Database lookup results:
⚠️ [API] NO products found in database for this store!
```

**This will tell you**:
- How many products from Shopify
- How many found in database
- Match rate percentage
- If no products found (need to sync)

## Most Likely Issue

**Products aren't in your database yet!**

The lookup query is correct, but if products haven't been synced:
- `dbProducts?.length` will be 0
- `dbIdMap.size` will be 0
- All products will have `dbId: null`

## Fix: Sync Products First

1. Go to Products page
2. Click "Sync Products" button
3. Wait for sync to complete
4. Refresh page
5. Products should now have `dbId`

## After Syncing - Verify

**Run this in Supabase SQL Editor**:

```sql
-- Check products were synced
SELECT 
  COUNT(*) as total,
  COUNT(DISTINCT store_id) as stores,
  COUNT(DISTINCT shopify_id) as unique_shopify_ids
FROM products;
```

**Should show**: Products count > 0

Then check browser console when loading products:
- Should see: `✅ Found X products with dbId in database`
- Should see: `dbIdIsUUID: true` in sample product

## If Still Failing

Share:
1. ✅ SQL query results (how many products in database?)
2. ✅ Server log output (what does lookup show?)
3. ✅ Browser console (do products have dbId?)

This will help identify the exact issue!

