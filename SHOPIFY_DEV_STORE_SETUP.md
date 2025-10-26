# Shopify Dev Store Setup Guide

## Step 1: Create a Shopify Development Store

### Option A: Using Shopify Partners (Recommended)
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Sign up for a Partner account (free)
3. In Partner Dashboard → Stores → Add store → Create development store
4. Choose "Create a store to test and build"
5. Enter store name (e.g., "Napoleon Test Store")
6. Select "Development store" and click "Create store"

### Option B: Using Shopify CLI (Alternative)
```bash
# Install Shopify CLI if not already installed
npm install -g @shopify/cli @shopify/theme

# Login to Shopify
shopify auth login

# Create a development store
shopify app generate
```

## Step 2: Get Your Shopify App Credentials

### From Shopify Partners Dashboard:
1. Go to your Partner Dashboard
2. Navigate to Apps → Create app
3. Choose "Public app" or "Custom app"
4. Fill in app details:
   - App name: "Napoleon3"
   - App URL: `http://localhost:3000`
   - Allowed redirection URL(s): `http://localhost:3000/api/auth/shopify/v2/callback`
5. In App setup → App URL, set:
   - App URL: `http://localhost:3000`
   - Allowed redirection URL(s): `http://localhost:3000/api/auth/shopify/v2/callback`
6. Copy your **Client ID** and **Client Secret**

### From Development Store Admin:
1. Go to your dev store admin: `https://your-store-name.myshopify.com/admin`
2. Navigate to Apps → App and sales channel settings
3. Click "Develop apps" → "Create an app"
4. Give it a name and configure permissions
5. Copy the **API key** and **API secret key**

## Step 3: Configure Environment Variables

Create a `.env.local` file in your project root with:

```env
# Shopify App Configuration
SHOPIFY_API_KEY=your_client_id_here
SHOPIFY_API_SECRET=your_client_secret_here
SHOPIFY_SCOPES=read_products,write_products,read_orders,read_customers,write_customers

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SHOPIFY_API_VERSION=2024-10

# Supabase Configuration (get from your Supabase project)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Encryption key for storing tokens securely (generate a random 32-character string)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Optional: Shopify Webhook Secret
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here
```

## Step 4: Update shopify.app.toml

Your `shopify.app.toml` already has the correct configuration:
- Client ID: `eb49208f806430d7c4e39b914be9a18a`
- App URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/api/auth/shopify/callback`

## Step 5: Test the Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to `http://localhost:3000`

3. Navigate to Settings → Shopify Integration

4. Click "Connect Store" and enter your dev store domain (e.g., `your-store-name.myshopify.com`)

5. Complete the OAuth flow

## Step 6: Verify Data Sync

After connecting, your app should:
- ✅ Store the access token securely
- ✅ Register webhooks for product updates
- ✅ Sync initial product data
- ✅ Display connected stores in Settings

## Troubleshooting

### Common Issues:

1. **"Invalid shop domain" error**
   - Make sure you're using the full domain: `store-name.myshopify.com`
   - Check that the store exists and is accessible

2. **OAuth callback errors**
   - Verify redirect URL matches exactly: `http://localhost:3000/api/auth/shopify/v2/callback`
   - Check that SHOPIFY_API_SECRET is set correctly

3. **"Server configuration error"**
   - Ensure all environment variables are set
   - Check that SHOPIFY_API_KEY and SHOPIFY_API_SECRET are correct

4. **Database connection issues**
   - Verify Supabase credentials are correct
   - Check that database migrations have been run

### Getting Help:
- Check the browser console for detailed error messages
- Look at server logs in your terminal
- Verify all environment variables are loaded correctly

## Next Steps

Once connected, you can:
1. View and manage products from your dev store
2. Test pricing strategies
3. Set up automated price changes
4. Monitor analytics and performance

Your app is already configured to handle all of this automatically!
