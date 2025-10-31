# SOLUTION: OAuth Redirect URI Matching Issue

## The Real Root Cause

When Shopify says "redirect_uri and application url must have matching hosts", it's comparing:

**The `redirect_uri` parameter you send** vs **The "Application URL" field in Partner Dashboard**

NOT the "Allowed redirection URLs" list!

## Exact Steps to Fix

### Step 1: Get the Exact redirect_uri Being Sent

1. Try to connect a store (trigger OAuth)
2. Check your **server logs** (where `shopify app dev` is running)
3. Look for: `🔐 OAuth initiated - DETAILED DEBUG:`
4. Copy the `oauthUrl.full` value
5. Extract the `redirect_uri` parameter from that URL

Example:
```
oauthUrl.full: https://store.myshopify.com/admin/oauth/authorize?client_id=xxx&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fshopify%2Fv2%2Fcallback&...
                                                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                                     This is what Shopify sees (URL encoded)
```

Decoded: `http://localhost:3000/api/auth/shopify/v2/callback`

### Step 2: Extract the Host from redirect_uri

From `http://localhost:3000/api/auth/shopify/v2/callback`:
- **Host** = `localhost:3000`
- **Protocol** = `http:`
- **Full origin** = `http://localhost:3000`

### Step 3: Verify Partner Dashboard Application URL

1. Go to: https://partners.shopify.com/
2. Navigate to: **Apps** → **Napoleon3** → **Configuration**
3. Find **"Application URL"** field (this is the critical one!)
4. It MUST be exactly: `http://localhost:3000`

### Step 4: Character-by-Character Comparison

Use a text editor to compare:

**What code sends (redirect_uri host):**
```
http://localhost:3000
```

**What Partner Dashboard Application URL should be:**
```
http://localhost:3000
```

They must match EXACTLY, including:
- ✅ No trailing slash (`http://localhost:3000/` is WRONG)
- ✅ Correct protocol (`https://` is WRONG if you're using `http://`)
- ✅ Correct port (`:3000` must be present)
- ✅ Correct hostname (`127.0.0.1` is DIFFERENT from `localhost`)
- ✅ No whitespace before/after
- ✅ No hidden characters

### Step 5: Common Hidden Issues

1. **Trailing slash:**
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

5. **Whitespace (invisible!):**
   ```
   ❌ Application URL: " http://localhost:3000 "  (has spaces)
   ✅ Should be:      http://localhost:3000
   ```

## Verification Checklist

After updating Partner Dashboard:

- [ ] Application URL = `http://localhost:3000` (exactly, no trailing slash)
- [ ] No spaces before/after the URL
- [ ] Protocol matches (http:// not https://)
- [ ] Port matches (:3000)
- [ ] Hostname matches (localhost, not 127.0.0.1)
- [ ] Clicked "Save" in Partner Dashboard
- [ ] Waited 1-2 minutes for changes to propagate
- [ ] Restarted dev server if needed

## Test

1. Clear browser cache
2. Try OAuth connection again
3. Check server logs for the detailed debug output
4. The `redirect_uri` in the OAuth URL should match your Application URL's host

## Still Not Working?

If it's still failing after exact match:

1. **Copy the EXACT Application URL** from Partner Dashboard (use Copy button, don't type)
2. **Compare it byte-by-byte** with what's in the server logs
3. **Check for invisible Unicode characters** or encoding issues
4. **Try setting Application URL to the EXACT redirect_uri** (including the path):
   ```
   Application URL: http://localhost:3000/api/auth/shopify/v2/callback
   ```
   (Some Shopify configurations require this)

