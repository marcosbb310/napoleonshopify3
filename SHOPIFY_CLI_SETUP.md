# Shopify CLI Setup Guide

This guide explains how to use Shopify CLI to develop and test your app with automatic URL management.

## 🎯 What Shopify CLI Does

When you run `shopify app dev`, it:
1. ✅ Starts your Next.js development server
2. ✅ Creates a secure tunnel (ngrok) so Shopify can reach your localhost
3. ✅ **Automatically updates your Shopify Partner Dashboard URLs** to match the tunnel
4. ✅ Provides `SHOPIFY_APP_URL` environment variable with the tunnel URL
5. ✅ Eliminates OAuth redirect URI mismatches

## 📋 Prerequisites

- Shopify CLI installed (you have it: version 3.85.2)
- Shopify Partner account
- App configured in `shopify.app.toml`

## 🚀 Quick Start

### Step 1: Navigate to Project Root

```bash
cd /Users/marcosbb310/Desktop/code/napoleonshopify3
```

### Step 2: Start with Shopify CLI

```bash
shopify app dev
```

**What happens:**
1. CLI will ask you to log in to Shopify Partners (if not already)
2. It will detect your `shopify.app.toml` configuration
3. It will start your Next.js server on port 3000
4. It will create a tunnel URL (like `https://abc123.ngrok.io`)
5. It will automatically update your Shopify Partner Dashboard with:
   - App URL: `https://abc123.ngrok.io`
   - Redirect URL: `https://abc123.ngrok.io/api/auth/shopify/v2/callback`

### Step 3: Connect a Store

1. Open your app at the tunnel URL (shown in terminal)
2. Sign in to your app
3. Go to **Settings** → **Stores** tab
4. Click **"Connect New Store"**
5. Enter your store domain (e.g., `your-store.myshopify.com`)
6. OAuth will work automatically! ✅

## 🔧 How It Works

### Code Changes

Your code now automatically detects Shopify CLI:

```typescript
// Automatically uses SHOPIFY_APP_URL when available (from Shopify CLI)
// Falls back to NEXT_PUBLIC_APP_URL for manual setup
const BASE_URL = process.env.SHOPIFY_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
```

**Updated files:**
- `src/app/api/auth/shopify/v2/initiate/route.ts` - OAuth initiation
- `src/app/api/auth/shopify/v2/callback/route.ts` - OAuth callback & webhooks
- `src/app/api/webhooks/shopify/test/route.ts` - Webhook testing
- `src/app/api/stores/reconnect/route.ts` - Store reconnection

### Environment Variables

**With Shopify CLI (`shopify app dev`):**
- `SHOPIFY_APP_URL` - Automatically set by CLI (e.g., `https://abc123.ngrok.io`)
- Other env vars from `.env.local` still work

**Without Shopify CLI (manual setup):**
- `NEXT_PUBLIC_APP_URL` - Must be set manually in `.env.local`
- Must manually configure Shopify Partner Dashboard URLs

## 📝 Configuration Files

### `shopify.app.toml`

Your current configuration:

```toml
client_id = "eb49208f806430d7c4e39b914be9a18a"
name = "Napoleon3"
application_url = "http://localhost:3000"
embedded = true

[auth]
redirect_urls = [ "http://localhost:3000/api/auth/shopify/v2/callback" ]
```

**Note:** When using `shopify app dev`, these URLs are automatically overridden with the tunnel URL. The CLI manages this for you!

## 🐛 Troubleshooting

### Issue: "Command not found: shopify"

**Solution:**
```bash
npm install -g @shopify/cli@latest
```

### Issue: "You need to be authenticated"

**Solution:**
```bash
shopify auth login
```

### Issue: "App not found"

**Solution:**
1. Check `shopify.app.toml` has correct `client_id`
2. Make sure the app exists in your Shopify Partners account
3. Run `shopify app info` to verify connection

### Issue: Still getting OAuth redirect errors

**Solution:**
1. Make sure you're using `shopify app dev` (not `npm run dev`)
2. Check terminal output for the tunnel URL
3. Verify the tunnel URL matches what's shown in Shopify Partner Dashboard
4. The CLI should update this automatically - if not, restart `shopify app dev`

### Issue: Tunnel URL changes every time

**This is normal!** Each time you restart `shopify app dev`, you get a new tunnel URL. The CLI automatically updates your Partner Dashboard.

## 🔄 Comparison: Shopify CLI vs Manual Setup

| Feature | Shopify CLI (`shopify app dev`) | Manual Setup (`npm run dev`) |
|---------|-------------------------------|------------------------------|
| URL Management | ✅ Automatic | ❌ Manual |
| Tunnel Creation | ✅ Automatic | ❌ Use ngrok separately |
| OAuth Redirects | ✅ Always works | ⚠️ Must match manually |
| Partner Dashboard | ✅ Auto-updated | ❌ Manual updates |
| Development Speed | ✅ Faster | ❌ Slower |

## 📚 Additional Commands

### Check App Info
```bash
shopify app info
```

### List All Apps
```bash
shopify app list
```

### Deploy App
```bash
shopify app deploy
```

### View Logs
Logs appear in the terminal where you ran `shopify app dev`.

## 🎉 Benefits

1. **No More OAuth Errors** - URLs always match automatically
2. **Faster Development** - No manual configuration needed
3. **Production-Like Environment** - Tunnel provides HTTPS
4. **Easy Testing** - Can test from any device (tunnel is public)
5. **Automatic Updates** - Partner Dashboard always in sync

## 🔗 Next Steps

After successfully connecting a store with `shopify app dev`:

1. Products will automatically sync
2. Webhooks will be registered automatically
3. You can test OAuth flow anytime
4. When ready for production, deploy and update URLs manually

---

**Note:** You can still use `npm run dev` for frontend-only development, but for OAuth and webhooks, use `shopify app dev`.

