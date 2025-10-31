# How to Fix "Product Not Found" Error

## The Problem
Your products are showing on the page, but when you toggle smart pricing, you get "Product not found". This happens because your products aren't yet saved in your local Supabase database - they're only being fetched from Shopify API.

## The Solution: Sync Your Products

### Option 1: Use the Sync Button (If Available)
1. Look for a "Sync Products" or "Update Products" button on the products page
2. Click it to sync products from Shopify to your database
3. Wait for it to finish
4. Then try the toggle again

### Option 2: Manually Sync via API
If there's no sync button, call this API endpoint:

```bash
curl -X POST http://localhost:3000/api/shopify/sync \
  -H "Content-Type: application/json" \
  -d '{"storeId": "YOUR_STORE_ID"}'
```

Replace `YOUR_STORE_ID` with your actual store ID (you can find it in the browser console or database).

### Option 3: Check Your Database
Run this SQL in Supabase to see if products exist:

```sql
SELECT COUNT(*) FROM products WHERE store_id = 'YOUR_STORE_ID';
```

If the count is 0, your products aren't synced yet.

## After Syncing
Once products are in your database, the toggle should work because it will find the products by `shopify_id`.

