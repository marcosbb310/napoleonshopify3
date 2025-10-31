# How to Verify Smart Pricing Disable is Working

## Overview
When you click "Global Disable Smart Pricing", all products should revert to their base prices. This guide shows how to verify this is actually happening.

## Method 1: Check Browser Console Logs

1. Open your browser's Developer Tools (F12 or Cmd+Option+I)
2. Go to the Console tab
3. Click the "Global Disable" button
4. Look for these logs:

### What to Look For:
```
🔄 GLOBAL DISABLE REQUEST STARTED
✅ Store authenticated: your-store.myshopify.com
📦 Found X products with smart pricing enabled
💰 Product [ID]: Current=[old price], Reverting to=[base price]
🔧 Updating product [ID]: [old price] → [base price]
✅ Updated product [ID]
✅ All products updated successfully
🔍 Verifying price updates...
✅ VERIFIED product [ID]: Price = [base price]
✅ ALL X products verified successfully!
📊 VERIFICATION RESULTS: { total: X, verified: X, failed: 0 }
```

### What It Means:
- **✅ VERIFIED product [ID]: Price = X** - The price was successfully reverted
- **❌ VERIFICATION FAILED** - If you see this, the price update didn't work
- **Verification Results** - Shows how many products were successfully reverted

## Method 2: Check the Server Logs

If you're running the dev server, check the terminal where `npm run dev` is running. You should see the same detailed logs showing each product being updated.

## Method 3: Visual Verification on the Product Page

1. **Before clicking disable**: Note the current price of a few products
2. **Click "Global Disable Smart Pricing"**
3. **After the action completes**: The products should automatically refetch and show their base prices
4. **What to look for**: 
   - Prices should change to the lower "base" price
   - The pricing toggle switch should be OFF (grey) for each product
   - The PowerButton should turn GREY (OFF)

## Method 4: Check Database Directly

Run this SQL query in Supabase:

```sql
SELECT 
  p.id,
  p.shopify_id,
  p.title,
  p.current_price,
  p.starting_price,
  pc.pre_smart_pricing_price,
  pc.auto_pricing_enabled,
  pc.last_smart_pricing_price
FROM products p
LEFT JOIN pricing_config pc ON p.id = pc.product_id
WHERE p.store_id = 'YOUR_STORE_ID'
ORDER BY p.title;
```

**Expected Results After Disable:**
- `current_price` should equal either `pre_smart_pricing_price` or `starting_price`
- `auto_pricing_enabled` should be `false`
- `last_smart_pricing_price` should show the old price that was reverted from

## Method 5: Check the Network Tab

1. Open Browser DevTools
2. Go to the Network tab
3. Click "Global Disable"
4. Find the request to `/api/pricing/global-disable`
5. Click on it
6. Go to the "Response" tab
7. Look for the `verification` object:

```json
{
  "success": true,
  "count": 5,
  "productSnapshots": [...],
  "verification": {
    "total": 5,
    "verified": 5,
    "failed": 0,
    "results": [
      {
        "productId": "xxx",
        "expectedPrice": 29.99,
        "actualPrice": 29.99,
        "verified": true
      }
    ]
  }
}
```

## Troubleshooting

### Prices aren't reverting?
1. Check console logs for errors
2. Verify the products have `pre_smart_pricing_price` or `starting_price` set
3. Check if `auto_pricing_enabled` is actually `false` in the database

### Verification failed for some products?
- Check the server logs for the specific products
- The logs will show the expected vs actual price
- Common issue: The product doesn't have a valid `pre_smart_pricing_price` or `starting_price`

### Products aren't refetching in the UI?
- The `onSuccess` callback should trigger `queryClient.refetchQueries({ queryKey: ['products'] })`
- Check the browser console for React Query logs
- Try manually refreshing the page

## Expected Behavior

When global disable completes:
1. ✅ All products with smart pricing enabled are found
2. ✅ Each product's price is updated to its base price
3. ✅ Each product's `auto_pricing_enabled` is set to `false`
4. ✅ The verification confirms all prices were updated correctly
5. ✅ The UI automatically refetches and shows the new prices
6. ✅ The PowerButton turns grey (OFF)
7. ✅ All product toggle switches turn grey (OFF)

## Success Indicators

You should see:
- ✅ Console message: "All prices verified successfully!"
- ✅ Products show their base/starting prices
- ✅ PowerButton is grey (OFF)
- ✅ Individual product toggles are grey (OFF)
- ✅ `verification.failed` is 0 in the response

