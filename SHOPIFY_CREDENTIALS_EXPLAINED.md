# Shopify Credentials Explained

## TL;DR: What You Need to Know

**SHOPIFY_API_SECRET is NOT an access token.** It's your app's secret key used to authenticate the OAuth flow.

---

## Understanding Your Shopify Credentials

### 1. App-Level Credentials (ALWAYS NEEDED) ✅

These are your app's identity - similar to a username and password for your app itself.

#### `SHOPIFY_API_KEY` (Also called Client ID)
- **What it is**: Your app's public identifier from Shopify Partners Dashboard
- **Used for**: Starting the OAuth flow, identifying your app to Shopify
- **Location**: `shopify.app.toml` (client_id = "eb49208f806430d7c4e39b914be9a18a")
- **Production**: ❌ Keep it private, ❌ Expose to users
- **Still needed in production?**: ✅ YES, ALWAYS

#### `SHOPIFY_API_SECRET` (Also called Client Secret)
- **What it is**: Your app's secret key (NOT an access token!)
- **Used for**: 
  1. Verifying HMAC signatures from Shopify (security)
  2. Exchanging authorization codes for access tokens
- **Location**: Environment variable `.env.local`
- **Security**: 🔒 KEEP IT SECRET, NEVER expose to users or frontend
- **Still needed in production?**: ✅ YES, ALWAYS

**How it's used in your code:**
```typescript
// 1. Verifying HMAC (security check)
const expectedHmac = crypto
  .createHmac('sha256', SHOPIFY_API_SECRET)
  .update(message)
  .digest('hex');

// 2. Exchanging code for access token
await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
  body: JSON.stringify({
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET, // <-- Used here
    code: params.code,
  }),
});
```

---

### 2. Store-Specific Access Tokens (Per User/Store) ✅

These are generated during OAuth and stored securely per store.

#### Store Access Token (Encrypted in Database)
- **What it is**: The actual token that allows API calls to a specific store
- **Format**: `shpat_xxxxx` (Shopify Admin API Token)
- **Storage**: Encrypted in Supabase database (`stores` table)
- **Used for**: Making API calls on behalf of the connected store
- **Still needed in production?**: ✅ YES, critical for operations

**Flow:**
1. User connects their store via OAuth
2. App receives store-specific access token
3. Token is encrypted and stored in database
4. Token is used for all API calls for that store

**Example in your code:**
```typescript
// When user connects store - tokens are stored
export async function encryptAndStoreTokens(
  userId: string,
  shopDomain: string,
  tokens: TokenSet
): Promise<string> {
  // Token is encrypted and stored per store
  const { data: encryptedToken } = await supabase.rpc('encrypt_token', {
    token_text: tokens.accessToken, // Store-specific token
    key: ENCRYPTION_KEY,
  });
}
```

---

### 3. Legacy Fallback Credentials (OPTIONAL) ⚠️

These are fallbacks when store-specific tokens aren't available.

#### `NEXT_PUBLIC_SHOPIFY_STORE_URL`
- **What it is**: A default store URL
- **Purpose**: Fallback when testing, not needed for production users
- **Still needed in production?**: ⚠️ NO - only for testing/development

#### `NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN`
- **What it is**: A default store access token
- **Purpose**: Fallback for development, bypasses OAuth for testing
- **Security risk**: Storing tokens in env vars is LESS secure
- **Still needed in production?**: ⚠️ NO - should be removed for production

**Why you won't need these:**
- Each user's store gets its own access token during OAuth
- Token is stored encrypted in database, NOT in environment
- Multiple users/stores = multiple tokens in database

---

## Production Checklist

### ✅ KEEP These (Critical for Production)

```env
# Your app credentials (from Shopify Partners Dashboard)
SHOPIFY_API_KEY=your_app_api_key
SHOPIFY_API_SECRET=your_app_secret

# OAuth configuration
SHOPIFY_SCOPES=read_products,write_products,read_orders

# App URL
NEXT_PUBLIC_APP_URL=https://your-production-domain.com

# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Encryption (for storing tokens securely)
ENCRYPTION_KEY=your_32_byte_key

# API Version
NEXT_PUBLIC_SHOPIFY_API_VERSION=2024-10

# Webhooks (if using)
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
```

### ❌ REMOVE These (Not Needed in Production)

```env
# Legacy fallbacks - NOT needed for real users
NEXT_PUBLIC_SHOPIFY_STORE_URL=your-store.myshopify.com  # ❌ Remove
NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN=shpat_xxxxx             # ❌ Remove
```

---

## How It Works in Production

### OAuth Flow for Real Users:

1. **User connects store** → Clicks "Connect Store" button
2. **Your app** → Uses `SHOPIFY_API_KEY` to build OAuth URL
3. **User authorizes** → Shopify redirects back with code
4. **Your app** → Uses `SHOPIFY_API_SECRET` to verify HMAC
5. **Exchange code** → `SHOPIFY_API_SECRET` used to get access token
6. **Store token** → Access token encrypted and saved to database
7. **Future requests** → Use stored token for API calls

### Example: Multiple Users

```
User A connects store-a.myshopify.com
  → Gets token: shpat_abc123
  → Stored encrypted in database with store_id
  → Used for store-a API calls

User B connects store-b.myshopify.com
  → Gets token: shpat_def456
  → Stored encrypted in database with store_id
  → Used for store-b API calls

No conflicts! Each token is isolated per store.
```

---

## Common Questions

### Q: Is SHOPIFY_API_SECRET the access token?
**A:** No! `SHOPIFY_API_SECRET` is your app's secret key. The access tokens are generated per store and stored in the database.

### Q: Why does each user need their own token?
**A:** Each Shopify store owner must authorize your app separately. Their token gives you permission to access their specific store.

### Q: What if I want to test without OAuth?
**A:** Keep the legacy credentials (`NEXT_PUBLIC_SHOPIFY_STORE_URL` and `NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN`) for development only. Remove them for production.

### Q: Can I share tokens between users?
**A:** No! Each store gets its own token. Sharing tokens would violate Shopify's security model and terms of service.

---

## Security Best Practices

### DO: ✅
- Keep `SHOPIFY_API_SECRET` in environment variables
- Encrypt store-specific tokens before storing
- Rotate webhook secrets regularly
- Use HTTPS in production
- Validate HMAC signatures

### DON'T: ❌
- Commit secrets to version control
- Expose `SHOPIFY_API_SECRET` to frontend
- Store tokens in plain text
- Share tokens between stores
- Use legacy credentials in production

---

## Summary

| Credential | Purpose | Still Needed? | Where Used |
|-----------|---------|---------------|------------|
| `SHOPIFY_API_KEY` | Identify your app | ✅ YES | OAuth initiation |
| `SHOPIFY_API_SECRET` | Authenticate your app | ✅ YES | HMAC verification, token exchange |
| Store Access Tokens | Per-store API access | ✅ YES | Database (encrypted) |
| `NEXT_PUBLIC_SHOPIFY_STORE_URL` | Fallback store URL | ❌ NO | Remove for production |
| `NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN` | Fallback token | ❌ NO | Remove for production |

---

## Quick Reference

**Your .env.local should look like this for production:**

```env
# REQUIRED - Your app credentials
SHOPIFY_API_KEY=eb49208f806430d7c4e39b914be9a18a
SHOPIFY_API_SECRET=your_client_secret_here

# REQUIRED - OAuth scopes
SHOPIFY_SCOPES=read_products,write_products,read_orders

# REQUIRED - App URL
NEXT_PUBLIC_APP_URL=https://your-production-domain.com

# REQUIRED - Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key

# REQUIRED - Encryption key (32 bytes)
ENCRYPTION_KEY=your_32_byte_key

# REQUIRED - API Version
NEXT_PUBLIC_SHOPIFY_API_VERSION=2024-10

# OPTIONAL - Webhooks
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# NOT NEEDED FOR PRODUCTION - Remove these:
# NEXT_PUBLIC_SHOPIFY_STORE_URL=... ❌
# NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN=... ❌
```
