# How to Debug the "Product not found for this store" Error

## Where to Check Logs

### 1. Browser Console (Client-side logs)

**How to open:**
- **Chrome/Edge**: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- **Firefox**: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
- **Safari**: Enable Developer menu first: Preferences → Advanced → "Show Develop menu", then press `Cmd+Option+C`

**What to look for:**
- Click the **Console** tab
- Look for messages starting with:
  - `🔘 [ProductName]` - Toggle click events
  - `❌` - Error messages
  - `🔍` - Debug information

**Example:**
```
🔘 [My Product] Toggle clicked - Current state: false
🟢 [My Product] Turning ON - calling API
❌ [My Product] Toggle error: Product not found for this store
```

### 2. Server Logs (Terminal where Next.js is running)

**Where to find:**
- The terminal/command prompt where you ran `npm run dev` or `yarn dev`
- This is where all `console.log()` and `console.error()` from API routes appear

**What to look for:**
- Messages starting with:
  - `🔷 PATCH /api/pricing/config/[productId]` - API route entry
  - `🔍 ===== SMART PRICING TOGGLE DEBUG =====` - Debug section
  - `🔍 [getVariantsByProductId]` - Variant lookup
  - `❌` - Error messages

**Example:**
```
🔷 PATCH /api/pricing/config/[productId] called with: 123456789
🔷 Request body: { auto_pricing_enabled: true }
🔷 Calling handleSmartPricingToggle
🔍 ===== SMART PRICING TOGGLE DEBUG =====
🔍 Received productId: 123456789
🔍 Enabled: true
🔍 Store ID provided: abc-123-def-456
========================================
🔍 [getVariantsByProductId] Querying variants by shopify_product_id: { shopifyProductId: '123456789', storeId: 'abc-123-def-456' }
❌ [getVariantsByProductId] No variants found: { shopifyProductId: '123456789', storeId: 'abc-123-def-456' }
```

### 3. Network Tab (API Request/Response)

**How to open:**
- Same as browser console (F12)
- Click the **Network** tab
- Filter by "Fetch/XHR" to see only API calls

**What to do:**
1. Click the smart pricing button
2. Look for a request to `/api/pricing/config/[productId]`
3. Click on it to see:
   - **Request**: What was sent (productId, body, headers)
   - **Response**: What the server returned (error message, debug info)

**What to check:**
- **Request Payload**: Verify `productId` and `auto_pricing_enabled` are correct
- **Response**: Look for the `debug` object that shows:
  - `productId`: The ID being used
  - `storeId`: The store ID
  - `isUUID`: Whether it's detected as a UUID or Shopify ID

### 4. Quick Debug Steps

1. **Open Browser Console** (F12 → Console tab)
2. **Open Network Tab** (F12 → Network tab)
3. **Click the smart pricing button** on a product card
4. **Check the Network tab** for the API request
5. **Click on the request** to see:
   - Request details (what was sent)
   - Response details (error message + debug info)
6. **Check the Console tab** for any client-side errors
7. **Check your terminal** (where `npm run dev` is running) for server-side logs

### 5. What Information to Share

If you're still getting errors, share:
1. **The productId** from the Network tab request
2. **The storeId** from the Network tab response debug object
3. **The full error message** from the Network tab response
4. **Any console errors** from the browser console
5. **Any server logs** from your terminal

This will help identify if:
- The productId format is wrong
- The storeId doesn't match
- The product doesn't exist in the database
- There's a database query issue

