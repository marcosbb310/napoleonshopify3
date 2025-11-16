# OAuth Security Model - What Actually Happens

## Current Security Layers

### Layer 1: Your App Authentication ✅
**Before OAuth even starts:**
- User must be logged into YOUR app (Supabase Auth)
- Checked in `/api/auth/shopify/v2/initiate` (line 29)
- If not logged in → Error: "You must be logged in to connect a store"

### Layer 2: Shopify Store Access ✅
**During OAuth:**
- User is redirected to Shopify's login page
- User must log into the Shopify store (Shopify's authentication)
- If user can't log in → OAuth fails

### Layer 3: App Installation Approval ✅
**After Shopify login:**
- Shopify shows consent screen: "Allow [Your App] to access your store?"
- User must click "Install" or "Allow"
- If user doesn't approve → OAuth fails

### Layer 4: Authorization Code Exchange ✅
**After approval:**
- Shopify redirects back with authorization code
- Your app exchanges code for access token
- Only works if code is valid and not expired

## What This Means

### ✅ SECURE: Cannot connect without Shopify access
**To connect a store, someone needs:**
1. Account in your app (Supabase Auth)
2. **Access to the Shopify store** (must be able to log in)
3. **Permission to install apps** (must be store owner/admin)

**So it's NOT "anyone with domain name"** - they need actual Shopify store credentials.

### ⚠️ VULNERABILITY (Before Fix): Duplicate Connections
**The problem we fixed:**
- If User A connects "mystore.myshopify.com"
- Then User B (who also has access to that Shopify store) connects it
- **Before fix**: System creates duplicate store for User B
- **After fix**: System prevents duplicate, shows error

## Real-World Scenarios

### Scenario 1: Legitimate Owner
1. Alice owns "mystore.myshopify.com"
2. Alice logs into your app
3. Alice connects her store
4. ✅ Works - Alice is the owner

### Scenario 2: Team Member (Before Fix - Problem)
1. Alice owns "mystore.myshopify.com" and connected it
2. Bob is an employee with access to the Shopify store
3. Bob logs into your app
4. Bob tries to connect "mystore.myshopify.com"
5. **Before fix**: Creates duplicate store for Bob ❌
6. **After fix**: Shows error "Store already connected to another account" ✅

### Scenario 3: Unauthorized Access (Blocked)
1. Eve doesn't have access to "mystore.myshopify.com"
2. Eve knows the domain name
3. Eve tries to connect it
4. **OAuth fails** at Shopify login step ✅
5. Cannot proceed without Shopify credentials

## Security Guarantees

### ✅ What's Protected
1. **Shopify login required** - Cannot connect without store access
2. **App approval required** - User must explicitly approve
3. **HMAC verification** - Prevents tampering
4. **No duplicate stores** (after our fix)

### ⚠️ What's NOT Protected (Before Fix)
1. **Multiple users connecting same store** - Could create duplicates
2. **No ownership verification** - First to connect becomes owner
3. **No invitation system** - Anyone with Shopify access can connect

## The Fix We Implemented

**Before:**
```typescript
// Only checked if store exists for THIS user
if (store exists for user) → update
else → create new store  // ❌ Could create duplicate
```

**After:**
```typescript
// Step 1: Check if store exists for THIS user
if (store exists for user) → update ✅

// Step 2: Check if store exists for ANOTHER user
if (store exists for other user) → ERROR ❌ // Prevents duplicate

// Step 3: Store doesn't exist
else → create new store ✅
```

## What Users See

### If They Have Shopify Access But Store Already Connected:
```
❌ This Shopify store is already connected to another account.
If you believe this is an error, please contact support.
To reconnect your store, please disconnect it first from the other account.
```

### If They Don't Have Shopify Access:
```
❌ Shopify Login Failed
You don't have access to this store.
```

## Bottom Line

**Security is good:**
- ✅ Requires Shopify store login
- ✅ Requires app approval
- ✅ HMAC verification
- ✅ No unauthorized access possible

**What we fixed:**
- ✅ Prevents duplicate stores
- ✅ Prevents unauthorized reassignment
- ✅ Clear error messages

**What's still needed (for true multi-user):**
- ⚠️ Invitation system (so team members can be added properly)
- ⚠️ Role-based permissions (owner/admin/viewer)
- ⚠️ Ownership transfer (if needed)

