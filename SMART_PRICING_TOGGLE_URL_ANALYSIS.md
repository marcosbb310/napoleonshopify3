# Smart Pricing Toggle - URL Construction Analysis

## 🔍 Overview

This document analyzes the exact fetch call that toggles smart pricing, including URL construction, environment variables, and scenarios where `productId` or `storeId` could be undefined.

---

## 1. 📍 Exact Fetch URL Construction

### Primary Fetch Location
**File**: `src/features/pricing-engine/hooks/useSmartPricingMutations.ts`  
**Function**: `useUpdatePricingConfig()`  
**Line**: 228

```228:228:src/features/pricing-engine/hooks/useSmartPricingMutations.ts
      const url = `/api/pricing/config/${encodedProductId}`;
```

### URL Construction Flow

1. **ProductId Encoding** (Line 216):
```216:216:src/features/pricing-engine/hooks/useSmartPricingMutations.ts
      const encodedProductId = encodeURIComponent(productId);
```

2. **URL Assembly** (Line 228):
```228:228:src/features/pricing-engine/hooks/useSmartPricingMutations.ts
      const url = `/api/pricing/config/${encodedProductId}`;
```

3. **Fetch Call** (Line 248):
```248:252:src/features/pricing-engine/hooks/useSmartPricingMutations.ts
      const response = await authenticatedFetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_pricing_enabled }),
      });
```

### Final URL Format
```
/api/pricing/config/{encodedProductId}
```

**Example**: `/api/pricing/config/123456789` or `/api/pricing/config/undefined` (if productId is undefined)

---

## 2. 🌍 Environment Variables

### ❌ NO Environment Variables Used in URL Construction

The URL is a **relative path** and does NOT use any environment variables directly. However:

### Environment Variables Used Indirectly

1. **Store Authentication** (via `useAuthenticatedFetch`):
   - The `x-store-id` header is added by `useAuthenticatedFetch()` 
   - Store ID comes from `useCurrentStore()` hook (not from env vars)
   - Store ID is stored in localStorage and fetched from database

2. **API Base URL**:
   - The URL is relative (`/api/...`), so it uses the current domain
   - No `NEXT_PUBLIC_APP_URL` or similar is used for this endpoint

3. **Shopify API Version** (used in other endpoints, NOT this one):
   - `NEXT_PUBLIC_SHOPIFY_API_VERSION` - Used in Shopify API calls, not in pricing toggle

---

## 3. ⚠️ Places Where `productId` Could Be Undefined

### 3.1 ProductCard Component

**File**: `src/features/product-management/components/ProductCard.tsx`  
**Lines**: 91-95

```91:95:src/features/product-management/components/ProductCard.tsx
  // Get product ID for API calls
  // CRITICAL: product.id comes from shopify_id in the database transformation
  // If shopify_id is null/undefined, product.id will be undefined
  // Try multiple possible ID fields as fallback
  const apiProductId = product.id || (product as any).shopify_id || (product as any).shopifyId;
```

**Problem Scenarios**:
- `product.id` is `undefined` (if `shopify_id` is null in database)
- `product.shopify_id` is `undefined` (fallback fails)
- `product.shopifyId` is `undefined` (fallback fails)

**Result**: `apiProductId` becomes `undefined`

### 3.2 useProducts Hook - Product Transformation

**File**: `src/features/shopify-integration/hooks/useProducts.ts`  
**Lines**: 154-164

```154:164:src/features/shopify-integration/hooks/useProducts.ts
      // Transform data to match ShopifyProduct interface
      // CRITICAL: Ensure shopify_id exists, otherwise filter out the product
      const transformedProducts: ShopifyProduct[] = (data || [])
        .filter(product => {
          if (!product.shopify_id) {
            console.warn(`⚠️ Product "${product.title}" (db_id: ${product.id}) has no shopify_id - skipping`);
            return false;
          }
          return true;
        })
        .map(product => ({
        id: product.shopify_id!, // Non-null assertion since we filtered above
```

**Problem Scenarios**:
- Database product has `shopify_id = null`
- Product is filtered out (shouldn't appear in UI)
- BUT: If filter fails or race condition, `product.id` could be `undefined`

### 3.3 useSmartPricingToggle Hook

**File**: `src/features/pricing-engine/hooks/useSmartPricingToggle.ts`  
**Lines**: 159-160

```159:160:src/features/pricing-engine/hooks/useSmartPricingToggle.ts
  } = useSmartPricingToggle({
    productId: hasValidProductId ? apiProductId : 'INVALID', // Pass 'INVALID' instead of undefined so hook can detect it
```

**Problem Scenarios**:
- If `hasValidProductId` is `false`, hook receives `'INVALID'`
- Hook validates and blocks, but if validation fails, `productId` could be `undefined`

### 3.4 useUpdatePricingConfig Mutation

**File**: `src/features/pricing-engine/hooks/useSmartPricingMutations.ts`  
**Lines**: 168-196

```168:196:src/features/pricing-engine/hooks/useSmartPricingMutations.ts
    mutationFn: async ({ productId, auto_pricing_enabled }: UpdatePricingConfigRequest): Promise<UpdatePricingConfigResponse> => {
      // CRITICAL: Validate productId FIRST - before ANY logging or processing
      // Check EVERY possible invalid state
      const isInvalid = 
        productId === undefined || 
        productId === null || 
        productId === 'undefined' || 
        productId === 'null' || 
        productId === '' ||
        productId === 'INVALID' ||
        typeof productId !== 'string' ||
        (typeof productId === 'string' && productId.length === 0) ||
        (typeof productId === 'string' && productId.trim().length === 0);
      
      if (isInvalid || !productId) {
        const errorMsg = `BLOCKED: Cannot make API call - productId is invalid: ${JSON.stringify(productId)}. This product cannot use smart pricing.`;
        console.error('❌❌❌ [useUpdatePricingConfig] BLOCKING API CALL - Invalid productId:', {
          productId,
          type: typeof productId,
          value: JSON.stringify(productId),
          isUndefined: productId === undefined,
          isNull: productId === null,
          isStringUndefined: productId === 'undefined',
          isEmpty: productId === '',
          isInvalid,
        });
        // Throw error to prevent API call - THIS MUST HAPPEN BEFORE ANY FETCH
        throw new Error(errorMsg);
      }
```

**Validation**: Multiple checks prevent `undefined` from reaching the URL, BUT if validation is bypassed:

**Problem Scenarios**:
- `productId` is `undefined` → `encodeURIComponent(undefined)` → `"undefined"` (string)
- URL becomes: `/api/pricing/config/undefined`

---

## 4. ⚠️ Places Where `storeId` Could Be Undefined

### 4.1 useAuthenticatedFetch Hook

**File**: `src/shared/lib/apiClient.ts`  
**Lines**: 41-57

```41:57:src/shared/lib/apiClient.ts
export function useAuthenticatedFetch() {
  const { currentStore, isLoading } = useCurrentStore()
  
  return (url: string, options: RequestInit = {}) => {
    if (isLoading) {
      console.warn('⚠️ Store is still loading, waiting...')
      throw new Error('Store is still loading. Please wait.')
    }
    
    if (!currentStore?.id) {
      console.error('❌ No store selected for API call', {
        currentStore,
        isLoading,
        url
      })
      throw new Error('No store selected. Please connect a Shopify store in Settings.')
    }
```

**Problem Scenarios**:
- `currentStore` is `null` (no stores available)
- `currentStore.id` is `undefined` (store object exists but missing ID)
- `isLoading` is `true` (race condition)

**Result**: Fetch throws error BEFORE making request (good!)

### 4.2 useCurrentStore Hook

**File**: `src/features/auth/hooks/useCurrentStore.ts`  
**Lines**: 60-62

```60:62:src/features/auth/hooks/useCurrentStore.ts
  const currentStore = stores && stores.length > 0 
    ? (stores.find(s => s.id === storeId) || stores[0]) 
    : null
```

**Problem Scenarios**:
- `stores` is `null` or `undefined`
- `stores.length === 0` (no stores connected)
- `storeId` doesn't match any store (falls back to `stores[0]`, but if that's missing ID...)

---

## 5. 🚨 Scenarios Where URL Could Become "undefined" or Malformed

### Scenario 1: Product Missing `shopify_id` in Database

**Code Path**:
1. Product synced from Shopify but `shopify_id` column is `NULL`
2. `useProducts` hook filters it out (line 156-161)
3. BUT: If filter fails or race condition, product appears with `id = undefined`
4. `ProductCard` receives `product.id = undefined`
5. `apiProductId = undefined`
6. Passed to `useSmartPricingToggle` as `'INVALID'`
7. Validation should block, but if bypassed:
8. `encodeURIComponent(undefined)` → `"undefined"` (string)
9. URL: `/api/pricing/config/undefined`

**Prevention**: ✅ Multiple validation checks in place

### Scenario 2: Race Condition During Store Switch

**Code Path**:
1. User switches stores
2. `useCurrentStore` updates `storeId`
3. `useProducts` refetches with new `storeId`
4. Old products still in cache with old `storeId`
5. `ProductCard` renders with product from old store
6. `product.id` might be valid but wrong store context
7. `useAuthenticatedFetch` adds `x-store-id` header with NEW store
8. API receives productId from OLD store but storeId from NEW store
9. Mismatch → 404 error

**Prevention**: ✅ Query invalidation on store switch (line 85-88 in useCurrentStore)

### Scenario 3: Type Coercion Issue

**Code Path**:
1. `productId` is `null` (not `undefined`)
2. Validation checks `productId === undefined` → passes
3. `encodeURIComponent(null)` → `"null"` (string)
4. URL: `/api/pricing/config/null`

**Prevention**: ✅ Validation checks for `null` (line 173)

### Scenario 4: Empty String Edge Case

**Code Path**:
1. `productId` is `""` (empty string)
2. `encodeURIComponent("")` → `""` (empty string)
3. URL: `/api/pricing/config/`
4. Next.js route: `/api/pricing/config/[productId]` → `productId = ""`
5. API receives empty string

**Prevention**: ✅ Validation checks for empty string (line 176)

### Scenario 5: String "undefined" Literal

**Code Path**:
1. `productId` is the string `"undefined"` (not the value `undefined`)
2. Validation checks `productId === 'undefined'` → should catch
3. BUT: If check is bypassed:
4. `encodeURIComponent("undefined")` → `"undefined"`
5. URL: `/api/pricing/config/undefined`

**Prevention**: ✅ Validation checks for string `'undefined'` (line 174)

### Scenario 6: API Route Parameter Decoding

**File**: `src/app/api/pricing/config/[productId]/route.ts`  
**Lines**: 84-90

```84:90:src/app/api/pricing/config/[productId]/route.ts
    const resolvedParams = await params;
    const rawProductId = resolvedParams.productId;
    
    // CRITICAL: Decode the productId safely (Next.js auto-decodes, but handle edge cases)
    // Only decode if it looks encoded (contains %)
    const productId = rawProductId.includes('%') 
      ? decodeURIComponent(rawProductId) 
      : rawProductId;
```

**Problem Scenarios**:
- If URL is `/api/pricing/config/undefined`, `rawProductId = "undefined"`
- API checks `productId === 'undefined'` (line 101) → should return 400
- BUT: If check fails, API proceeds with `productId = "undefined"`

**Prevention**: ✅ API validates and returns 400 error (line 101-120)

---

## 6. 🔄 Complete Code Path Leading to "undefined" URL

### Step-by-Step Flow

1. **Product Fetch** (`useProducts.ts:164`):
   ```typescript
   id: product.shopify_id! // If shopify_id is null, this is undefined
   ```

2. **ProductCard Receives Product** (`ProductCard.tsx:95`):
   ```typescript
   const apiProductId = product.id || (product as any).shopify_id || (product as any).shopifyId;
   // If all are undefined, apiProductId = undefined
   ```

3. **Validation Check** (`ProductCard.tsx:98-103`):
   ```typescript
   const hasValidProductId = !!apiProductId && 
                            typeof apiProductId === 'string' && 
                            apiProductId.length > 0 &&
                            apiProductId !== 'undefined' &&
                            apiProductId !== 'null' &&
                            apiProductId !== 'INVALID';
   ```

4. **Hook Initialization** (`ProductCard.tsx:159-160`):
   ```typescript
   productId: hasValidProductId ? apiProductId : 'INVALID'
   ```

5. **Hook Validation** (`useSmartPricingToggle.ts:72-94`):
   ```typescript
   if (!productId || productId === 'undefined' || ...) {
     // Blocks and shows error
   }
   ```

6. **Mutation Validation** (`useSmartPricingMutations.ts:171-196`):
   ```typescript
   const isInvalid = productId === undefined || productId === 'undefined' || ...
   if (isInvalid) {
     throw new Error(...) // Blocks API call
   }
   ```

7. **URL Encoding** (`useSmartPricingMutations.ts:216`):
   ```typescript
   const encodedProductId = encodeURIComponent(productId);
   // If productId is undefined, this becomes "undefined" (string)
   ```

8. **URL Construction** (`useSmartPricingMutations.ts:228`):
   ```typescript
   const url = `/api/pricing/config/${encodedProductId}`;
   // If encodedProductId is "undefined", URL is "/api/pricing/config/undefined"
   ```

9. **Fetch Call** (`useSmartPricingMutations.ts:248`):
   ```typescript
   const response = await authenticatedFetch(url, {...});
   // Makes request to "/api/pricing/config/undefined"
   ```

10. **API Route Receives** (`route.ts:84-90`):
    ```typescript
    const rawProductId = resolvedParams.productId; // "undefined"
    const productId = rawProductId.includes('%') 
      ? decodeURIComponent(rawProductId) 
      : rawProductId; // "undefined"
    ```

11. **API Validation** (`route.ts:101-120`):
    ```typescript
    if (productId === 'undefined' || productId === undefined || !productId) {
      return NextResponse.json({ success: false, error: ... }, { status: 400 });
    }
    ```

---

## 7. ✅ Prevention Mechanisms

### Multiple Layers of Validation

1. **ProductCard** (lines 98-103): Validates `apiProductId` before passing to hook
2. **useSmartPricingToggle** (lines 72-94): Validates `productId` in `handleToggle`
3. **useSmartPricingToggle** (lines 114-132): Validates `productId` in `confirmEnable`
4. **useSmartPricingToggle** (lines 236-243): Validates `productId` in `handleConfirmToggle`
5. **useUpdatePricingConfig** (lines 171-196): Validates `productId` before encoding
6. **useUpdatePricingConfig** (lines 199-201): Double-checks `productId` is string
7. **useUpdatePricingConfig** (lines 211-213): Triple-checks `productId` is string
8. **useUpdatePricingConfig** (lines 219-226): Validates encoded `productId`
9. **useUpdatePricingConfig** (lines 231-239): Validates final URL
10. **API Route** (lines 101-120): Validates `productId` on server

---

## 8. 📊 Summary

### URL Construction
- **Base URL**: Relative path `/api/pricing/config/`
- **ProductId**: Encoded via `encodeURIComponent(productId)`
- **Final URL**: `/api/pricing/config/{encodedProductId}`
- **No Environment Variables**: URL is relative, no env vars used

### Undefined Scenarios
1. ✅ **Product missing `shopify_id`**: Filtered out in `useProducts`
2. ✅ **Race conditions**: Query invalidation on store switch
3. ✅ **Type coercion**: Multiple null/undefined checks
4. ✅ **Empty strings**: Validation checks for empty string
5. ✅ **String "undefined"**: Explicit check for `'undefined'` string
6. ✅ **API validation**: Server-side validation returns 400 error

### Store ID Scenarios
1. ✅ **No store selected**: `useAuthenticatedFetch` throws error before fetch
2. ✅ **Store loading**: Throws error if `isLoading` is true
3. ✅ **Store missing ID**: Throws error if `currentStore.id` is falsy

### Conclusion
**The code has extensive validation at multiple layers to prevent "undefined" URLs. However, if all validations are bypassed (edge case), the URL would become `/api/pricing/config/undefined`, which the API route would catch and return a 400 error.**

