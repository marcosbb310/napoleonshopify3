# Shopify OAuth Redirect URI Fix

## Problem
You're seeing this error when connecting a Shopify store:
```
Oauth error invalid_request: The redirect_uri and application url must have matching hosts
```

This happens because the redirect URI in your OAuth request doesn't match what's configured in your Shopify Partner Dashboard.

---

## Solution Steps

### Step 1: Create Your `.env.local` File

1. Copy `.env.example` to `.env.local`:
   ```bash
   cd napoleonshopify3
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your values:
   ```bash
   # CRITICAL: This must match your Shopify app's "App URL"
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   
   # Your Supabase credentials
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx...
   SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx...
   
   # Your Shopify app credentials
   SHOPIFY_API_KEY=your_api_key_here
   SHOPIFY_API_SECRET=your_api_secret_here
   
   # Generate encryption key
   ENCRYPTION_KEY=your_32_byte_key_here
   ```

3. Generate your encryption key:
   ```bash
   openssl rand -base64 32
   ```
   Copy the output into `ENCRYPTION_KEY` in `.env.local`

---

### Step 2: Configure Your Shopify Partner Dashboard

#### 2.1 Go to Shopify Partners Dashboard
1. Visit: https://partners.shopify.com/
2. Navigate to: **Apps** → **[Your App]** → **Configuration**

#### 2.2 Configure URLs (CRITICAL - Must Match Exactly!)

**For Local Development:**
```
App URL: http://localhost:3000
Allowed redirection URL(s):
  - http://localhost:3000/api/auth/shopify/callback
```

**For Production:**
```
App URL: https://your-domain.com
Allowed redirection URL(s):
  - https://your-domain.com/api/auth/shopify/callback
```

⚠️ **IMPORTANT:** 
- The protocol (http/https) MUST match
- The domain MUST match exactly
- The port (if using one) MUST match
- NO trailing slashes

#### 2.3 Save Configuration
Click **Save** in the Shopify Partner Dashboard.

---

### Step 3: Restart Your Dev Server

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

The server MUST restart to pick up the new environment variables.

---

### Step 4: Test the OAuth Flow

1. Go to your app: `http://localhost:3000`
2. Sign in
3. Go to **Settings** → **Stores** tab
4. Click **"Connect New Store"**
5. Enter your store domain: `your-store.myshopify.com`
6. Click **Connect**
7. You should be redirected to Shopify
8. Approve the app permissions
9. You should be redirected back and see "Store connected successfully!"

---

## Common Issues & Solutions

### Issue 1: Still Getting Redirect URI Error

**Cause:** URLs don't match between your app and Shopify Partner Dashboard.

**Fix:**
1. Check your `.env.local` → `NEXT_PUBLIC_APP_URL`
2. Check Shopify Partner Dashboard → Configuration → App URL
3. Make sure they EXACTLY match (including http/https and port)

### Issue 2: "Server configuration error"

**Cause:** Missing environment variables.

**Fix:**
Check that these are all set in `.env.local`:
```bash
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
ENCRYPTION_KEY=...
NEXT_PUBLIC_APP_URL=...
```

### Issue 3: Localhost Not Working

**Cause:** Shopify requires HTTPS for production apps.

**Fix for Development:**
1. In Shopify Partner Dashboard, make sure your app is set to **Development store** mode
2. Use `http://localhost:3000` (HTTP is allowed for development)

**Fix for Production:**
1. Deploy to a hosting provider with HTTPS
2. Update `.env.local` to use your production URL
3. Update Shopify Partner Dashboard URLs to match

### Issue 4: Getting "Missing shop parameter"

**Cause:** The store domain wasn't passed correctly.

**Fix:**
Make sure you're entering the full store domain, e.g.:
- ✅ `your-store.myshopify.com`
- ❌ `your-store`
- ❌ `https://your-store.myshopify.com` (no https://)

---

## Verification Checklist

Before testing, verify:

- [ ] `.env.local` file exists with all required variables
- [ ] `NEXT_PUBLIC_APP_URL` matches your development/production URL
- [ ] Shopify Partner Dashboard → App URL matches `NEXT_PUBLIC_APP_URL`
- [ ] Shopify Partner Dashboard → Allowed redirection URLs includes:
  - `{NEXT_PUBLIC_APP_URL}/api/auth/shopify/callback`
- [ ] Dev server was restarted after creating `.env.local`
- [ ] You're signed into your app
- [ ] You're entering a valid `.myshopify.com` domain

---

## URLs Reference

Here's what your URLs should look like:

### Development
| Setting | Value |
|---------|-------|
| `.env.local` → `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |
| Shopify → App URL | `http://localhost:3000` |
| Shopify → Redirect URI | `http://localhost:3000/api/auth/shopify/callback` |

### Production  
| Setting | Value |
|---------|-------|
| `.env` → `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` |
| Shopify → App URL | `https://your-domain.com` |
| Shopify → Redirect URI | `https://your-domain.com/api/auth/shopify/callback` |

---

## Still Having Issues?

If you're still experiencing issues:

1. **Check the browser console** for detailed error messages
2. **Check your server logs** for OAuth errors
3. **Verify your Shopify app is not in "Suspended" status**
4. **Make sure you're the owner/admin** of the Shopify store you're connecting
5. **Try with a development store** first before using a production store

---

## Next Steps After Connection

Once successfully connected:

1. The app will automatically sync your products
2. Check **Dashboard** to see sync status
3. Go to **Products** to see imported products
4. Configure pricing strategies in **Settings** → **Pricing**

