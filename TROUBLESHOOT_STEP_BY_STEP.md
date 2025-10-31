# Step-by-Step: Find Out Why "Product Not Found"

## Steps to Debug

### 1. Click the Toggle ONCE
When you click "Smart Pricing OFF" on any product, watch your **terminal where Next.js is running**.

### 2. Look For These Logs

You should see logs like this in your terminal:

```
🔍 ===== SMART PRICING TOGGLE DEBUG =====
🔍 Received productId: "123456789"
🔍 Store ID provided: "store-uuid-here"
🔍 Sample products in database: [...]
```

### 3. Check What's Missing

**Option A:** If "Store ID provided: NOT PROVIDED"
- The authentication isn't working
- The user isn't properly logged in

**Option B:** If Store ID is provided but product not found
- Check the "Sample products in database" array
- See if your product's `shopify_id` is in that list
- If NOT in the list → product belongs to different store or doesn't exist

**Option C:** If product IS in the sample list
- Check if it has a `pricing_config` record
- The database relationship might be broken

## Quick Test Command

Run this in a terminal to see your actual products:

```bash
# This will show you what products are in your database
# (You'll need to set up your Supabase credentials)
```

## Most Likely Cause

Based on the code, the most likely issue is:
**The product exists but doesn't have a `pricing_config` record yet.**

When products are synced, they should create a pricing_config automatically. If this didn't happen, the query fails because it tries to join with `pricing_config(*)`.

## The Quick Fix

Option 1: Re-sync your products (this will create missing pricing_config records)
Option 2: Manually create pricing_config records for existing products
Option 3: Make the query work without pricing_config

