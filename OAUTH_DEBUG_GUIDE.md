# OAuth Redirect URI Debug Guide

## What "Matching Hosts" Means

**Host** = The domain name part of a URL

### ✅ MATCHING (Same Host):
```
App URL:        http://localhost:3000          → host: localhost
Redirect URI:   http://localhost:3000/...      → host: localhost
✅ MATCH - Same host!
```

### ❌ NOT MATCHING (Different Hosts):
```
App URL:        http://localhost:3000          → host: localhost
Redirect URI:   https://example.com/...        → host: example.com
❌ NO MATCH - Different hosts!
```

## Current Configuration

Your code builds the redirect URI like this:
```typescript
const BASE_URL = process.env.SHOPIFY_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
const redirectUri = `${BASE_URL}/api/auth/shopify/v2/callback`;
```

So if `NEXT_PUBLIC_APP_URL=http://localhost:3000`, it sends:
- Redirect URI: `http://localhost:3000/api/auth/shopify/v2/callback`

## What Must Match in Shopify Partner Dashboard

1. **App URL**: `http://localhost:3000`
   - Host: `localhost`
   - Protocol: `http`
   - Port: `3000`

2. **Allowed redirection URL(s)**: 
   - Must include: `http://localhost:3000/api/auth/shopify/v2/callback`
   - Note: The path `/api/auth/shopify/v2/callback` must match exactly
   - Protocol (`http`), host (`localhost`), and port (`3000`) must all match

## Debug Steps

### Step 1: Check What URL Is Being Sent

Add this to your browser console or check server logs:
```javascript
// When initiating OAuth, the server logs show:
console.log('🔐 OAuth initiated:', {
  BASE_URL,
  redirectUri,
  // ... 
});
```

### Step 2: Verify Partner Dashboard Configuration

1. Go to: https://partners.shopify.com/
2. Navigate to: **Apps** → **Napoleon3** → **Configuration**
3. Check these fields:

**App URL field:**
```
http://localhost:3000
```
- ✅ Must be exactly `http://localhost:3000` (no trailing slash)
- ✅ Must use `http://` not `https://`
- ✅ Must include port `:3000`

**Allowed redirection URL(s) field:**
```
http://localhost:3000/api/auth/shopify/v2/callback
```
- ✅ Must include the exact path: `/api/auth/shopify/v2/callback`
- ✅ Must match protocol, host, and port of App URL
- ✅ Can have multiple URLs (one per line)

### Step 3: Common Mistakes

❌ **Wrong App URL:**
```
http://localhost:3000/          ← Trailing slash (WRONG)
https://localhost:3000           ← Wrong protocol (WRONG)
http://localhost                ← Missing port (WRONG)
http://127.0.0.1:3000           ← Different host (WRONG)
```

✅ **Correct App URL:**
```
http://localhost:3000           ← Perfect!
```

❌ **Wrong Redirect URI:**
```
http://localhost:3000/api/auth/shopify/callback    ← Missing /v2/ (WRONG)
http://localhost:3000/api/auth/shopify/v2/callback/  ← Trailing slash (WRONG)
```

✅ **Correct Redirect URI:**
```
http://localhost:3000/api/auth/shopify/v2/callback  ← Perfect!
```

## Quick Fix Checklist

- [ ] `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local`
- [ ] Partner Dashboard → App URL = `http://localhost:3000`
- [ ] Partner Dashboard → Allowed redirect URLs includes `http://localhost:3000/api/auth/shopify/v2/callback`
- [ ] No trailing slashes anywhere
- [ ] Protocol matches (both `http://`)
- [ ] Port matches (both `:3000`)
- [ ] Host matches (both `localhost`)
- [ ] Path matches exactly (`/api/auth/shopify/v2/callback`)

## How to Check What's Actually Being Sent

1. Open browser DevTools (F12)
2. Go to Network tab
3. Initiate OAuth connection
4. Look for the request to `/api/auth/shopify/v2/initiate`
5. Check the response - it should include the `oauthUrl`
6. Copy that URL and check the `redirect_uri` parameter

Example:
```
https://your-store.myshopify.com/admin/oauth/authorize?
  client_id=xxx&
  scope=read_products&
  redirect_uri=http://localhost:3000/api/auth/shopify/v2/callback&  ← Check this!
  state=xxx
```

The `redirect_uri` parameter must match what's in Partner Dashboard!

