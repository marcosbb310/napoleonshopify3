# 403 Error Troubleshooting Guide

## Problem
Products page shows error: "Failed to load products" with status 403

## Root Causes

### 1. **Invalid or Expired Shopify Access Token**
The most common cause. Your Shopify access token may have:
- Expired
- Been revoked in Shopify admin
- Been generated with insufficient permissions
- Been corrupted during storage

### 2. **Store Not Properly Connected**
- No store exists in the database
- Store exists but has no access token
- Token encryption/decryption is failing

### 3. **Missing Store Selection**
- No store is currently selected
- The `x-store-id` header is not being sent with requests

## Solutions

### Solution 1: Reconnect Your Store

1. Go to **Settings** page (`/settings`)
2. Find the "Shopify Connection" section
3. Click **"Disconnect Store"** if connected
4. Click **"Connect Shopify Store"** to re-authenticate
5. Follow the OAuth flow to grant permissions
6. Return to the Products page and verify it loads

### Solution 2: Check Store in Database

If you're still having issues, check the database:

```sql
-- Check if store exists
SELECT id, shop_domain, access_token, access_token_encrypted, created_at
FROM stores
WHERE user_id = (SELECT id FROM users WHERE auth_user_id = 'YOUR_USER_ID');

-- Check if token is encrypted or plain
SELECT 
  id,
  shop_domain,
  CASE 
    WHEN access_token_encrypted IS NOT NULL THEN 'Encrypted'
    WHEN access_token IS NOT NULL THEN 'Plain'
    ELSE 'Missing'
  END as token_status,
  LENGTH(access_token) as token_length
FROM stores
WHERE user_id = (SELECT id FROM users WHERE auth_user_id = 'YOUR_USER_ID');
```

### Solution 3: Regenerate Shopify Access Token

1. Go to Shopify Admin → **Apps → Develop apps**
2. Find your app
3. Go to **Configuration** tab
4. Generate a new **Admin API access token**
5. Copy the new token
6. Update in Settings or reconnect the store

### Solution 4: Check Token Permissions

Your Shopify app needs these permissions:
- `read_products` - Required to fetch products
- `write_products` - Required to update product prices
- `read_inventory` - Recommended for inventory data

## Error Messages

### "No store selected. Please connect a Shopify store in Settings."
- **Cause**: No store is currently selected in the app
- **Solution**: Go to Settings and connect a Shopify store

### "Your Shopify access token is invalid or expired. Please reconnect your store in Settings."
- **Cause**: The access token is not valid
- **Solution**: Reconnect your store in Settings

### "HTTP error! status: 403"
- **Cause**: Shopify API rejected the request due to invalid token or insufficient permissions
- **Solution**: Reconnect your store or check app permissions in Shopify

## Debugging Steps

### 1. Check Server Logs
Look for lines starting with `❌ Shopify 403 Error:` in server logs:
```
❌ Shopify 403 Error: {
  storeId: '...',
  shopDomain: 'your-store.myshopify.com',
  tokenLength: 50,
  message: 'Forbidden'
}
```

### 2. Verify Store Connection
Check the `/api/auth/session` endpoint to see if a store is connected:
```bash
curl http://localhost:3000/api/auth/session \
  -H "Cookie: YOUR_SESSION_COOKIE"
```

### 3. Test API Directly
Test the Shopify API directly with your token:
```bash
curl https://YOUR-STORE.myshopify.com/admin/api/2024-10/products.json \
  -H "X-Shopify-Access-Token: YOUR_TOKEN"
```

If this returns 403, the token is definitely invalid.

## Prevention

1. **Always use OAuth flow** - Don't manually enter access tokens
2. **Keep app installed** - Don't uninstall the app from Shopify
3. **Don't regenerate tokens manually** - Let OAuth handle it
4. **Check token expiration** - Some tokens expire, OAuth auto-refreshes them

## Common Mistakes

❌ **Manually copying/pasting access tokens** - Use OAuth
❌ **Uninstalling the app from Shopify** - Breaks the connection
❌ **Using test tokens** - Test tokens don't work in production
❌ **Not granting all required permissions** - Apps need specific scopes

## Still Having Issues?

1. Check server logs for detailed error messages
2. Verify the store is in the database with correct credentials
3. Test the Shopify API directly with the access token
4. Try disconnecting and reconnecting the store
5. Check that your Shopify app has the correct permissions

If none of these solutions work, the issue may be with the Shopify app configuration or API version compatibility.

