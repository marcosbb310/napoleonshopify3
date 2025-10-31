# Fresh Start Guide - Shopify App Setup

## Step 1: Create New Shopify Partners App

1. Go to https://partners.shopify.com
2. Click "Apps" → "Create app"
3. Choose "Custom app" or "Public app" (for testing, Custom is fine)
4. Name it something like "Revenue Maximizer" or "Napoleon Pricing"

### App Configuration:
- **Store access**: Set to "All stores" (NOT "Same organization only")
- **Redirect URL**: `http://localhost:3000/api/auth/shopify/v2/callback`
- **Required scopes**:
  - `read_products`
  - `write_products`
  - `read_orders`
  - `read_inventory`
  - `read_customers` (optional)
  - `read_analytics` (optional)

5. Copy your new credentials:
   - **API Key** (Client ID)
   - **API Secret** (Client Secret)

## Step 2: Update Environment Variables

In your `.env.local` file, replace:

```bash
# OLD (remove these)
SHOPIFY_API_KEY=old_key_here
SHOPIFY_API_SECRET=old_secret_here

# NEW (add these)
SHOPIFY_API_KEY=your_new_api_key_here
SHOPIFY_API_SECRET=your_new_api_secret_here
```

**Keep everything else the same:**
- ✅ Supabase keys (no changes)
- ✅ Trigger.dev keys (no changes)
- ✅ Encryption key (no changes)
- ✅ All other env vars (no changes)

## Step 3: Clean Database (Optional)

If you want to start with a clean slate, run `cleanup-database.sql` in Supabase SQL Editor.

This will:
- Delete all products
- Delete all stores
- Delete OAuth sessions
- Delete sync status

**Note:** This is optional - you can also just reconnect stores without cleaning.

## Step 4: Restart Your Dev Server

```bash
# Stop your server (Ctrl+C)
npm run dev
```

## Step 5: Test Connection

1. Go to your webapp Settings page
2. Click "Connect Store"
3. Enter: `napolen-test-store.myshopify.com`
4. Approve permissions
5. Store should connect successfully!

## Step 6: Sync Products

After connecting:
1. Go to Products page
2. Select the connected store
3. Click "Sync Products"
4. Products should appear!

---

## What You DON'T Need to Change:

- ❌ Supabase database schema (tables stay the same)
- ❌ Trigger.dev setup (uses same database)
- ❌ Code files (no code changes needed)
- ❌ Migration files (database structure unchanged)
- ❌ Any other environment variables

---

## Troubleshooting

If you get "App can't be installed" error:
- Check Shopify Partners → Your App → App setup → Store access
- Make sure it's set to "All stores"

If OAuth redirect fails:
- Verify redirect URL in Shopify app matches: `http://localhost:3000/api/auth/shopify/v2/callback`
- Make sure `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local`

That's it! The fresh start is really just:
1. New Shopify app (5 minutes)
2. Update 2 env vars (1 minute)
3. Restart server (30 seconds)
4. Test connection (1 minute)

Total time: ~8 minutes
