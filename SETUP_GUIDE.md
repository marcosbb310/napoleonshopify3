# Shopify Store Setup & Testing Guide

## Understanding Your Setup

### Current Situation:
- **Shopify Account**: marcosbb310@gmail.com
- **Stores**:
  - "my store" - Has custom apps (Napoleon, Revenue Maximizer) in Develop apps
  - "revenue test" - No apps in Develop apps
  - "napoleon test store" (dev store) - No apps in Develop apps
- **Issue**: Your webapp uses OAuth (Shopify Partners app), NOT custom apps
- **Problem**: Custom apps created in "my store" CANNOT be used in other stores

## How Your App Actually Works

Your app uses **OAuth** (Shopify Partners app), which means:
1. You have `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` in your `.env`
2. These are from a Shopify Partners app (not a custom app)
3. This app can be installed in ANY store via OAuth flow
4. Each store gets its own access token when installed

## What You Need to Do

### Step 1: Run Diagnostic Queries

Run `diagnose-stores.sql` in Supabase SQL Editor to see:
- Which stores are in your database
- Which store has products
- Token status for each store

### Step 2: Clean Up Database (Optional but Recommended)

If you want to start fresh:

```sql
-- Delete old test data (CAREFUL - this deletes everything!)
-- Only run if you want to start completely fresh

-- Delete products from old stores
DELETE FROM public.products WHERE store_id IN (
    SELECT id FROM public.stores WHERE shop_domain LIKE '%mystore%'
);

-- Or delete specific store
DELETE FROM public.stores WHERE shop_domain = 'your-old-store.myshopify.com';
```

### Step 3: Install Your App in Each Store (Like a Customer Would)

Your app should have an "Install" or "Connect Store" button. When clicked:

1. **For "napoleon test store"**:
   - Click "Connect Store" in your webapp
   - Enter: `napolen-test-store.myshopify.com`
   - Shopify will show permission screen
   - Approve permissions
   - Your app will receive callback and store token

2. **For "revenue test"**:
   - Same process, enter that store's domain
   - Each store gets its own token

### Step 4: Test Product Sync

After connecting a store:

```sql
-- Check if store was created
SELECT id, shop_domain, is_active FROM public.stores;

-- Then trigger sync via API or UI
-- Check products after sync
SELECT COUNT(*) FROM public.products WHERE store_id = '<store_id>';
```

## Common Issues & Solutions

### Issue 1: "Store not found" in products page
**Solution**: Check `diagnose-stores.sql` - ensure `is_active = true` for the store

### Issue 2: Products showing from wrong store
**Solution**: 
- Check which `store_id` is selected in your UI
- Verify products have correct `store_id` foreign key
- Run diagnostic query #5 to find orphaned products

### Issue 3: Token doesn't work
**Solution**:
- Ensure OAuth flow completed successfully
- Check `access_token` or `access_token_encrypted` exists in `stores` table
- Verify token has correct scopes (read_products, read_inventory)

### Issue 4: Custom apps vs OAuth confusion
**Solution**: 
- Custom apps in "my store" → CANNOT use in other stores
- OAuth Partners app → CAN be installed in any store
- Your webapp uses OAuth, so ignore custom apps

## Testing as a Customer

1. **Sign Up**: Create account in your webapp
2. **Log In**: Use credentials
3. **Connect Store**: 
   - Click "Connect Shopify Store"
   - Enter store domain (e.g., `napolen-test-store.myshopify.com`)
   - Approve permissions
   - Store gets saved to database
4. **Sync Products**: 
   - Click "Sync Products" button
   - Products should appear from that store
5. **Verify**: 
   - Products page shows products from connected store
   - Can switch between stores if multiple connected

## Environment Variables Needed

Make sure these are set in your `.env`:

```bash
# Shopify Partners App (OAuth)
SHOPIFY_API_KEY=your_partners_app_api_key
SHOPIFY_API_SECRET=your_partners_app_secret

# Shopify API Version
NEXT_PUBLIC_SHOPIFY_API_VERSION=2025-01

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Encryption (for token storage)
ENCRYPTION_KEY=your_base64_encoded_32_char_key

# App URL (for OAuth callback)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Next Steps

1. ✅ Run `diagnose-stores.sql` to see current state
2. ✅ Check which store is currently active/selected in your webapp
3. ✅ Connect your app to "napoleon test store" via OAuth flow
4. ✅ Trigger product sync
5. ✅ Verify products appear correctly

## Quick Test Commands

After connecting a store, test the token:

```bash
# Get token from database (if stored in plain text)
# Then test:
curl -H "X-Shopify-Access-Token: <token>" \
  "https://napolen-test-store.myshopify.com/admin/api/2025-01/products.json?limit=1"
```

If this returns 200, sync will work!
