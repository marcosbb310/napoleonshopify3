# Fix: App Mismatch Issue

## Problem

Your `shopify.app.toml` is configured for **"Napoleon3"** (old app), but you created a **new app called "Napoleon"**. This causes OAuth validation to fail because:

1. OAuth requests use the old app's `client_id`
2. Shopify validates against the **new app's** configuration
3. They don't match → OAuth error!

## Solution: Update shopify.app.toml

### Step 1: Get Your New App's Client ID

1. Go to: https://partners.shopify.com/
2. Navigate to: **Apps** → **Napoleon** (your new app)
3. Go to: **Configuration** or **App setup**
4. Find **"Client ID"** (also called "API key" or "App ID")
5. Copy it

### Step 2: Update shopify.app.toml

Edit `napoleonshopify3/shopify.app.toml`:

```toml
# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "YOUR_NEW_APP_CLIENT_ID_HERE"  # ← Replace with new app's Client ID
name = "Napoleon"                           # ← Change from "Napoleon3" to "Napoleon"
application_url = "http://localhost:3000"
embedded = true

[webhooks]
api_version = "2025-10"

[access_scopes]
scopes = "read_products,write_products,read_orders"
optional_scopes = []
use_legacy_install_flow = true

[auth]
redirect_urls = [ "http://localhost:3000/api/auth/shopify/v2/callback" ]
```

### Step 3: Verify Partner Dashboard Settings

In **Apps → Napoleon → Configuration**:

- **Application URL**: `http://localhost:3000`
- **Allowed redirection URL(s)**: `http://localhost:3000/api/auth/shopify/v2/callback`

### Step 4: Update Environment Variable

Make sure your `.env.local` has the correct `SHOPIFY_API_KEY`:

```bash
SHOPIFY_API_KEY=YOUR_NEW_APP_CLIENT_ID_HERE  # Must match client_id in shopify.app.toml
```

### Step 5: Restart Shopify CLI

1. Stop `shopify app dev` (Ctrl+C)
2. Restart: `cd napoleonshopify3 && shopify app dev`
3. Verify it shows: **App name: Napoleon** (not Napoleon3)

## Alternative: Link App Automatically

If you prefer, run this in your terminal:

```bash
cd napoleonshopify3
shopify app config link
```

Then select:
- Organization: Napoleon
- App: Napoleon (your new app)
- Dev store: napolen-test-store.myshopify.com

This will automatically update `shopify.app.toml` with the correct values.

## Verify It's Fixed

After updating:

1. Check `shopify app info` shows the correct app
2. Try OAuth connection again
3. Check server logs - should use correct `client_id`

