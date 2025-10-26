# How to Fix Store Permissions

## Problem
The `napolen-test-store` was connected without proper OAuth permissions, so it has an empty scope and can't load products.

## Solution: Reconnect the Store

### Step 1: Go to Settings
1. Navigate to http://localhost:3000/settings
2. Click on the "Integrations" tab

### Step 2: Disconnect the Store
1. Find the `napolen-test-store` card
2. Click "Disconnect"

### Step 3: Reconnect with Full Permissions
1. Click "+ Connect New Store"
2. Enter your Shopify store URL (e.g., `napolen-test-store.myshopify.com`)
3. Click "Continue"
4. **Important:** When Shopify asks you to approve permissions, make sure ALL checkboxes are selected:
   - ✅ Read products
   - ✅ Write products
   - ✅ Read orders
5. Click "Install App" in Shopify
6. You'll be redirected back to the app

### Step 4: Verify Permissions
1. Go back to Settings → Integrations
2. You should now see:
   - `napolen-test-store`
   - **Permissions:** `read_products,write_products,read_orders` (NOT empty!)
3. Go to Products page
4. Products should load!

## What I Changed in the Code

I updated `shopify.app.toml` to ensure all scopes are requested:

```toml
scopes = "read_products,write_products,read_orders"  # Was: scopes = ""
optional_scopes = []  # Was: [ "read_orders", "read_products", "write_products" ]
use_legacy_install_flow = true  # Changed from false
```

This ensures that when you connect a store, it will ALWAYS request these permissions.

## Why This Happened

When stores are connected, the OAuth flow should save the `scope` parameter returned by Shopify. The `napolen-test-store` was connected at some point when the scope wasn't being saved properly, resulting in an empty string.

After reconnecting, you should see the scope field populated with all three permissions.

## Test It

After reconnecting:
1. Go to Products page
2. You should see products from `napolen-test-store` 
3. Switch between stores - both should work
4. Check console logs - you should see `scope: "read_products,write_products,read_orders"` instead of `scope: ""`

