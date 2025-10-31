# Deep OAuth Debugging Guide

## The Real Problem

The error "redirect_uri and application url must have matching hosts" means Shopify is comparing:

1. **Application URL** field in Partner Dashboard (NOT the redirect URLs list!)
2. **redirect_uri** parameter in the OAuth request

These must have **matching hosts** (protocol + hostname + port).

## Critical Insight

When using **legacy install flow** (`use_legacy_install_flow = true`), Shopify validates:
- The `redirect_uri` you send in the OAuth request
- Against the **Application URL** field in Partner Dashboard

NOT against the "Allowed redirection URLs" list!

## What to Check

### Step 1: Verify What's Being Sent

1. **Check server logs** when you initiate OAuth
2. Look for: `🔐 OAuth initiated - DETAILED DEBUG:`
3. Copy the `oauthUrl.full` value
4. Extract the `redirect_uri` parameter from that URL

### Step 2: Verify Partner Dashboard Application URL

1. Go to: https://partners.shopify.com/
2. Navigate to: **Apps** → **Napoleon3** → **Configuration**
3. Find the **"Application URL"** field (NOT "Allowed redirection URLs")
4. Copy the EXACT value
5. Compare character by character:

```
What your code sends:  http://localhost:3000/api/auth/shopify/v2/callback
                        └──────────────┬──────────────┘
                                      ↑
                        Host must match Application URL host

Partner Dashboard Application URL: http://localhost:3000
                                   └──────────────┬──────────────┘
                                                 ↑
                        These hosts MUST match exactly!
```

### Step 3: Common Hidden Issues

1. **Trailing slash in Application URL:**
   ```
   ❌ Application URL: http://localhost:3000/
   ✅ Should be:      http://localhost:3000
   ```

2. **Wrong protocol:**
   ```
   ❌ Application URL: https://localhost:3000
   ✅ Should be:      http://localhost:3000
   ```

3. **Missing port:**
   ```
   ❌ Application URL: http://localhost
   ✅ Should be:      http://localhost:3000
   ```

4. **Different host representation:**
   ```
   ❌ Application URL: http://127.0.0.1:3000
   ✅ Should be:      http://localhost:3000
   ```

5. **Whitespace:**
   ```
   ❌ Application URL: " http://localhost:3000 "
   ✅ Should be:      http://localhost:3000
   ```

## Debug Endpoint

Visit: `http://localhost:3000/api/auth/shopify/v2/verify-urls`

This will show:
- What URL is configured
- How it's parsed
- What should be in Partner Dashboard

## The Fix

1. **Check the server logs** during OAuth initiation
2. **Copy the exact `redirect_uri` from the OAuth URL**
3. **Extract the host** from that redirect_uri (protocol + hostname + port)
4. **Set Application URL in Partner Dashboard** to match that host EXACTLY
5. **Remove any trailing slashes, whitespace, or differences**

## Example

If your code sends:
```
redirect_uri=http://localhost:3000/api/auth/shopify/v2/callback
```

Then Partner Dashboard must have:
```
Application URL: http://localhost:3000
```

NOT:
- `http://localhost:3000/` (trailing slash)
- `https://localhost:3000` (wrong protocol)
- `http://localhost` (missing port)
- Any other variation

