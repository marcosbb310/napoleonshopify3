# Codebase Audit and Fix Plan - Complete Implementation Guide

**Date**: November 15, 2024  
**Purpose**: Fix critical issues causing "Store not found" errors, missing images, React key errors, cache invalidation failures, and performance issues

---

## EXECUTIVE SUMMARY

### What We're Fixing

This plan addresses critical issues causing:
1. **"Store not found" errors** when syncing products
2. **Missing product images** after sync completes
3. **React key prop errors** in the products page ("Each child in a list should have a unique key" prop)
4. **Cache invalidation failures** causing stale data
5. **Performance issues** from redundant database queries

### Root Causes Identified

1. **Authentication Inconsistency**: Sync route uses different auth pattern than other routes
2. **Store ID Source Mismatch**: Some routes expect header (`x-store-id`), others expect body (`storeId`)
3. **Duplicate shopify_ids**: Database has duplicate products with same `shopify_id` causing React key errors
4. **NULL shopify_ids**: Some products missing IDs, causing React rendering issues
5. **Query Key Inconsistencies**: Different cache keys (`['products', storeId, filters]` vs `['products', storeId]`) prevent proper invalidation
6. **Double Filtering**: Server-side + client-side filtering causing redundant queries on every filter change
7. **React Query Violations**: Direct `fetch` calls bypassing React Query cache (`fetchPerformanceData`, price update, test sync, pricing run)
8. **Test Page Confusion**: Multiple test pages (`products-test`, `products-test2`) using different hooks/data sources

### Expected Outcomes

After completing this plan:
- ✅ Sync button works reliably without "Store not found" errors
- ✅ Products display with images after sync
- ✅ No React key prop errors in console
- ✅ Cache invalidation works correctly after mutations
- ✅ Filtering is instant (no loading states on filter changes)
- ✅ All data fetching uses React Query consistently

---

## ASSUMPTIONS

### Codebase State Assumptions

1. **Database Schema**:
   - `products` table exists with `shopify_id`, `store_id`, `images` columns
   - `product_variants` table exists with proper relationships
   - Migration `028_add_product_images.sql` has been run (images column exists)
   - RLS policies are enabled and working

2. **Environment**:
   - Next.js 15.5.4 (Webpack)
   - React Query (TanStack Query) is set up and working
   - Supabase client is configured correctly
   - Environment variables are set (SHOPIFY_API_KEY, etc.)

3. **Current State**:
   - Sync route exists at `src/app/api/shopify/sync/route.ts`
   - Products page exists at `src/app/(app)/products/page.tsx`
   - Test pages exist (will be deleted in Phase 2)
   - React Query Provider is set up in `src/shared/components/QueryProvider.tsx`
   - `requireStore()` helper exists at `src/shared/lib/apiAuth.ts`

4. **Data**:
   - Stores have ~1000 products (including variants)
   - Some products may have duplicate `shopify_id` values (to be fixed)
   - Some products may have NULL `shopify_id` (to be fixed)

5. **User Access**:
   - You have access to Supabase SQL Editor
   - You can run database queries
   - You can modify code files
   - You can test in browser

### What We're NOT Changing

- Database schema structure (only adding constraints if missing)
- Product data (only cleaning duplicates)
- Core business logic
- External API integrations (Shopify API usage)

---

## SUCCESS CRITERIA

### Phase 1: Sync Route & Data Integrity
- ✅ **4.1**: Unique constraint exists on `(store_id, shopify_id)` OR `shopify_id`
- ✅ **4.2**: Duplicate check query returns 0 rows
- ✅ **4.3**: NULL shopify_id check returns 0 active rows
- ✅ **4.4**: If duplicates existed, they are cleaned up (backup created, duplicates removed)
- ✅ **4.5**: NULL shopify_id products are deactivated or fixed
- ✅ **4.6**: React key fallback added: `key={product.id || `fallback-${index}`}`
- ✅ **4.7**: Sync process logs duplicate prevention (no warnings in console)
- ✅ **4.8**: ID normalization test passes (no collisions)
- ✅ **Sync Route**: Uses `requireStore()` or standardized pattern
- ✅ **Store ID**: Single pattern used consistently (body OR header)
- ✅ **Store Validation**: Single query with all conditions

**Browser Test**: 
- Open products page, check console - no React key errors
- Run sync - no "Store not found" errors
- Products display correctly

### Phase 2: Delete Test Pages
- ✅ Test pages deleted: `products-test/page.tsx`, `products-test2/page.tsx`
- ✅ No broken imports or references
- ✅ Main products page still works

**Browser Test**: 
- Navigate to `/products-test` - should 404
- Navigate to `/products` - should work normally

### Phase 3: React Query Violations
- ✅ `fetchPerformanceData` converted to `useQuery` hook
- ✅ Price update uses `updateProductPrice` mutation (from existing useProducts hook)
- ✅ Test sync uses `useTestSync` mutation hook
- ✅ Pricing run uses `usePricingRun` mutation hook
- ✅ No direct `fetch` calls in products page (except authenticatedFetch for mutations)

**Browser Test**: 
- Open products page, check Network tab - all requests go through React Query
- View analytics - should use React Query hook
- Update price - should use mutation hook
- No console errors about missing React Query

### Phase 4: Query Key & Performance
- ✅ Query key changed to `['products', storeId]` (no filters)
- ✅ Server-side filtering removed from database query
- ✅ All invalidations use `['products', storeId]` pattern
- ✅ Client-side filtering works correctly

**Browser Test**: 
- Change filters - should be instant (no loading spinner)
- Check React Query DevTools - single cache entry per store
- Run sync - products refetch correctly
- Filter by search/vendor/price - all work instantly

### Phase 5: Image Issues
- ✅ Image transformation logic simplified
- ✅ Better error logging added
- ✅ Images display correctly after sync

**Browser Test**: 
- Run sync - products should have images
- Check products page - images display correctly
- Check console - no image transformation errors

### Phase 6: Standardization
- ✅ Error messages are consistent
- ✅ Field naming is standardized
- ✅ Code follows patterns

**Browser Test**: 
- Trigger various errors - messages should be consistent
- Check code - naming conventions followed

---

## TESTING INSTRUCTIONS

### Phase 1 Testing

**Before Starting**:
1. Open browser console (F12)
2. Navigate to `/products` page
3. Note any React key errors in console
4. Note any "Store not found" errors

**After Phase 1**:
1. **Test Database Queries**:
   - Run verification queries (4.1, 4.2, 4.3) in Supabase SQL Editor
   - Verify all return expected results (0 duplicates, 0 NULLs)

2. **Test React Key Fix**:
   - Refresh products page
   - Check console - should see NO "Each child in a list should have a unique key" errors
   - Products should render correctly

3. **Test Sync Route**:
   - Click "Sync Products" button
   - Should NOT see "Store not found" error
   - Should see success toast with sync statistics
   - Products should update after sync

4. **Test Duplicate Prevention**:
   - Run sync multiple times
   - Check database - should not create duplicate products
   - Check console - should see duplicate prevention logs (if added)

### Phase 2 Testing

**After Phase 2**:
1. Navigate to `/products-test` - should get 404
2. Navigate to `/products-test2` - should get 404
3. Navigate to `/products` - should work normally
4. Check for broken imports - run `npm run build` (should succeed)

### Phase 3 Testing

**After Phase 3**:
1. **Test Performance Data**:
   - Click on a product to view analytics
   - Open Network tab - should see request to `/api/products/[id]/performance`
   - Should use React Query (check React Query DevTools)
   - Data should cache correctly

2. **Test Price Update**:
   - Update a product price
   - Should use `updateProductPrice` mutation
   - Should invalidate cache automatically
   - Price should update in UI immediately

3. **Test Mutations**:
   - All mutations should use React Query hooks
   - Check Network tab - requests should be through React Query
   - No direct `fetch` calls in products page

### Phase 4 Testing

**Before Phase 4**:
- Note filter change latency (should be 50-200ms with loading spinner)

**After Phase 4**:
1. **Test Filtering Performance**:
   - Change search filter - should be INSTANT (< 10ms, no loading spinner)
   - Change vendor filter - should be INSTANT
   - Change price range - should be INSTANT
   - All filtering should happen client-side

2. **Test Cache**:
   - Open React Query DevTools
   - Should see single cache entry: `['products', storeId]`
   - No multiple cache entries for different filters
   - After sync, cache should invalidate correctly

3. **Test Initial Load**:
   - Clear cache, reload page
   - Initial load should fetch all products once
   - Should be fast (< 2 seconds for ~1000 products)

### Phase 5 Testing

**After Phase 5**:
1. **Test Image Display**:
   - Run sync
   - Check products page - all products should have images
   - Images should display correctly
   - No broken image icons

2. **Test Image Transformation**:
   - Check console - no image transformation errors
   - Images should load correctly
   - Product cards should show images

### Phase 6 Testing

**After Phase 6**:
1. **Test Error Messages**:
   - Trigger various error scenarios
   - Error messages should be consistent in format
   - Messages should be helpful and clear

2. **Test Code Quality**:
   - Run linter - should pass
   - Check naming conventions - should be consistent
   - Code should follow patterns

---

## ROLLBACK STEPS

### If Phase 1 Breaks Something

**Database Rollback**:
```sql
-- If duplicate cleanup went wrong, restore from backup
INSERT INTO products
SELECT * FROM products_duplicates_backup
WHERE id NOT IN (SELECT id FROM products);

-- Verify restore
SELECT COUNT(*) FROM products_duplicates_backup;
SELECT COUNT(*) FROM products WHERE id IN (SELECT id FROM products_duplicates_backup);
```

**Code Rollback**:
- Revert changes to `src/app/(app)/products/page.tsx` (React key fix)
- Revert changes to `src/features/shopify-integration/services/syncProducts.ts` (logging)
- Revert changes to sync route authentication

**Git Rollback**:
```bash
git checkout HEAD -- src/app/(app)/products/page.tsx
git checkout HEAD -- src/features/shopify-integration/services/syncProducts.ts
git checkout HEAD -- src/app/api/shopify/sync/route.ts
```

### If Phase 2 Breaks Something

**Restore Test Pages**:
```bash
git checkout HEAD -- src/app/(app)/products-test/page.tsx
git checkout HEAD -- src/app/(app)/products-test2/page.tsx
```

### If Phase 3 Breaks Something

**Restore Direct Fetch Calls**:
- Revert changes to `src/app/(app)/products/page.tsx`
- Restore `fetchPerformanceData` function
- Restore direct fetch calls for price update

**Git Rollback**:
```bash
git checkout HEAD -- src/app/(app)/products/page.tsx
git checkout HEAD -- src/features/product-management/hooks/usePerformanceData.ts
```

### If Phase 4 Breaks Something

**Restore Query Keys**:
- Revert query key to `['products', storeId, filters]`
- Restore server-side filtering in `useProducts` hook
- Revert cache invalidation patterns

**Git Rollback**:
```bash
git checkout HEAD -- src/features/shopify-integration/hooks/useProducts.ts
git checkout HEAD -- src/app/(app)/products/page.tsx
git checkout HEAD -- src/features/pricing-engine/hooks/useSmartPricingMutations.ts
```

### If Phase 5 Breaks Something

**Restore Image Transformation**:
- Revert changes to image transformation logic
- Restore original complex transformation

**Git Rollback**:
```bash
git checkout HEAD -- src/features/shopify-integration/hooks/useProducts.ts
```

### General Rollback Strategy

1. **Before Each Phase**: Commit current state
   ```bash
   git add .
   git commit -m "Before Phase X: [Phase Name]"
   ```

2. **If Something Breaks**: 
   ```bash
   git log --oneline  # Find commit before phase
   git reset --hard <commit-hash>  # Rollback to that commit
   ```

3. **Database Rollback**: Use backups created in Phase 1 (4.4)

4. **Partial Rollback**: Use `git checkout HEAD -- <file>` for specific files

---

## IMPLEMENTATION PLAN

### Phase 1: Fix Critical Sync Route Issues & Data Integrity (FOUNDATION - No Dependencies)
**Why First**: Sync route is foundational - other features depend on sync working correctly. Data integrity must be verified first.

**4. Verify and Fix Duplicate shopify_id Issues (CRITICAL - Fixes React Key Error)**

   **4.1 Verify Database Unique Constraint**
   - **Action**: Check if composite unique constraint exists on `(store_id, shopify_id)`
   - **Location**: Run in Supabase SQL Editor
   - **Query**: 
     ```sql
     SELECT 
       conname AS constraint_name,
       contype AS constraint_type,
       pg_get_constraintdef(oid) AS constraint_definition
     FROM pg_constraint
     WHERE conrelid = 'products'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) LIKE '%shopify_id%';
     ```
   - **Expected Result**: Should see unique constraint on `(store_id, shopify_id)` or just `shopify_id`
   - **If Missing**: Create unique constraint:
     ```sql
     -- Create composite unique constraint if it doesn't exist
     DO $$ 
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_constraint 
         WHERE conrelid = 'products'::regclass 
         AND contype = 'u'
         AND pg_get_constraintdef(oid) LIKE '%store_id%shopify_id%'
       ) THEN
         ALTER TABLE products 
         ADD CONSTRAINT products_store_shopify_unique 
         UNIQUE (store_id, shopify_id);
       END IF;
     END $$;
     ```

   **4.2 Find Duplicate shopify_ids (Within Same Store)**
   - **Action**: Identify products with duplicate shopify_ids within the same store
   - **Location**: Run in Supabase SQL Editor
   - **Query**: 
     ```sql
     -- Find duplicate shopify_ids within same store
     SELECT 
       store_id,
       shopify_id,
       COUNT(*) as duplicate_count,
       array_agg(id ORDER BY updated_at DESC) as product_ids,
       array_agg(title ORDER BY updated_at DESC) as titles,
       array_agg(updated_at ORDER BY updated_at DESC) as update_times
     FROM products
     WHERE shopify_id IS NOT NULL
       AND is_active = true
     GROUP BY store_id, shopify_id
     HAVING COUNT(*) > 1
     ORDER BY duplicate_count DESC, store_id;
     ```
   - **Expected Result**: Should return 0 rows (no duplicates)
   - **If Duplicates Found**: Note the duplicate_count, product_ids, titles, and update_times for cleanup

   **4.3 Find Products with NULL shopify_id**
   - **Action**: Identify products with missing shopify_id (will cause React key errors)
   - **Location**: Run in Supabase SQL Editor
   - **Query**: 
     ```sql
     -- Find products with NULL shopify_id
     SELECT 
       id,
       store_id,
       title,
       shopify_id,
       created_at,
       updated_at,
       is_active
     FROM products
     WHERE shopify_id IS NULL
       AND is_active = true
     ORDER BY updated_at DESC;
     ```
   - **Expected Result**: Should return 0 rows (all products have shopify_id)
   - **If NULL Found**: Note the product IDs and titles - these need to be either fixed or deactivated

   **4.4 Clean Up Duplicate Products (If Found)**
   - **Action**: Remove duplicate products, keeping only the most recently updated version
   - **Location**: Run in Supabase SQL Editor
   - **IMPORTANT**: **BACKUP FIRST** - Export duplicate products before deletion
   - **Backup Query**:
     ```sql
     -- Backup duplicates before deletion
     CREATE TABLE products_duplicates_backup AS
     SELECT * FROM products
     WHERE id IN (
       SELECT unnest(product_ids[2:]) -- All except first (newest)
       FROM (
         SELECT 
           store_id,
           shopify_id,
           array_agg(id ORDER BY updated_at DESC) as product_ids
         FROM products
         WHERE shopify_id IS NOT NULL
           AND is_active = true
         GROUP BY store_id, shopify_id
         HAVING COUNT(*) > 1
       ) duplicates
     );
     ```
   - **Cleanup Query**:
     ```sql
     -- Delete duplicate products, keeping only the newest (first in array)
     -- CRITICAL: Only run after backup is confirmed
     WITH duplicates AS (
       SELECT 
         store_id,
         shopify_id,
         array_agg(id ORDER BY updated_at DESC) as product_ids
       FROM products
       WHERE shopify_id IS NOT NULL
         AND is_active = true
       GROUP BY store_id, shopify_id
       HAVING COUNT(*) > 1
     )
     DELETE FROM products
     WHERE id IN (
       SELECT unnest(product_ids[2:]) -- Delete all except first (newest)
       FROM duplicates
     )
     AND id IN (
       SELECT id FROM products_duplicates_backup -- Only delete backed up records
     );
     ```
   - **Verification Query**: Re-run duplicate check (4.2) - should return 0 rows

   **4.5 Handle Products with NULL shopify_id (If Found)**
   - **Action**: Either fix or deactivate products with NULL shopify_id
   - **Option A - Deactivate (Recommended if can't be fixed)**:
     ```sql
     -- Deactivate products with NULL shopify_id
     UPDATE products
     SET is_active = false,
         updated_at = NOW()
     WHERE shopify_id IS NULL
       AND is_active = true;
     ```
   - **Option B - Attempt to fix (Only if you have source data)**:
     - If products came from Shopify sync, they should have shopify_id
     - If NULL shopify_id products are orphaned/invalid, deactivate them
     - **Manual Fix**: Update shopify_id if you have the correct Shopify product ID
     - **Verification**: Re-run NULL check (4.3) - should return 0 active rows

   **4.6 Verify useProducts Hook Filters Null IDs**
   - **Action**: Verify hook properly filters out products without shopify_id
   - **Location**: `src/features/shopify-integration/hooks/useProducts.ts` (lines 182-187)
   - **Current Code**: Already filters `if (!product.shopify_id) { return false; }`
   - **Verification**: Check that this filter is working correctly
   - **Enhancement**: Add defensive check in products page React key:
     ```typescript
     // In products page, ensure key is always defined
     key={product.id || `fallback-${index}`}
     ```
   - **File**: `src/app/(app)/products/page.tsx` (line 1183)
   - **Change**: 
     ```typescript
     // BEFORE (line 1181-1183):
     {products.map((product) => (
       <ProductCard
         key={product.id}
     
     // AFTER (line 1181-1183):
     {products.map((product, index) => (
       <ProductCard
         key={product.id || `fallback-${index}`}
     ```

   **4.7 Verify Sync Process Uses Proper Upsert Logic**
   - **Action**: Verify sync uses `onConflict: 'store_id,shopify_id'` to prevent duplicates
   - **Location**: `src/features/shopify-integration/services/syncProducts.ts` (line 230-234)
   - **Current Code**: Already uses `onConflict: 'store_id,shopify_id'` ✅
   - **Verification**: Confirm this is working correctly
   - **Enhancement**: Add logging to verify duplicates are prevented:
     ```typescript
     // Add after upsert (line 234, after .select('id, title, shopify_id, images');)
     if (upsertedProducts && upsertedProducts.length > 0) {
       const uniqueIds = new Set(upsertedProducts.map(p => p.shopify_id));
       if (uniqueIds.size !== upsertedProducts.length) {
         console.error('❌ DUPLICATE WARNING: Upsert returned duplicate shopify_ids!');
         console.error('❌ Expected unique count:', uniqueIds.size, 'Got:', upsertedProducts.length);
       } else {
         console.log('✅ Duplicate prevention verified: All shopify_ids are unique');
       }
     }
     ```

   **4.8 Verify ID Normalization Doesn't Create Collisions**
   - **Action**: Ensure normalizeShopifyId doesn't create duplicate normalized IDs
   - **Location**: `src/shared/utils/shopifyIdNormalizer.ts`
   - **Verification**: Test normalization with sample IDs:
     ```typescript
     // Test normalization doesn't create collisions
     const testIds = [
       'gid://shopify/Product/123',
       '123',
       123,
       'product-123',
     ];
     const normalized = testIds.map(id => normalizeShopifyId(id));
     const uniqueNormalized = new Set(normalized);
     console.assert(uniqueNormalized.size === normalized.length, 'Normalization created duplicates!');
     ```

   **Testing Steps**:
   1. Run verification queries (4.1, 4.2, 4.3) - note any issues
   2. If duplicates found: Run backup query, verify backup created
   3. Run cleanup query (if duplicates), verify cleanup successful
   4. Re-run verification queries - should return 0 rows
   5. Test sync process - should not create new duplicates
   6. Test products page - should not show React key errors
   7. Verify React key fallback works for edge cases

**1. Standardize Sync Route Authentication**
   - **Current**: Uses `createRouteHandlerClient` and manual auth check (line 22)
   - **Target**: Use `requireStore()` helper OR update `requireStore()` to accept body fallback
   - **Location**: `src/app/api/shopify/sync/route.ts` (lines 16-91)
   - **Decision Needed**: Choose Option A (use requireStore with header) or Option B (update requireStore to accept body)
   - **Option A** (Recommended): Update frontend to send `x-store-id` header
     ```typescript
     // In sync mutation (useProducts hook), update fetch call:
     const response = await fetch('/api/shopify/sync', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'x-store-id': storeId,  // ADD THIS
       },
       body: JSON.stringify({ storeId }),
     });
     ```
   - **Option B**: Update `requireStore()` to accept `storeId` from body when header missing
     ```typescript
     // In src/shared/lib/apiAuth.ts, modify requireStore function:
     export async function requireStore(request: NextRequest, options?: { allowBody?: boolean }) {
       const { user, error } = await requireAuth(request);
       if (error) return { user: null, store: null, error };
       
       // Try header first (standard)
       let storeId = request.headers.get('x-store-id');
       
       // Fallback to body if header missing and option enabled
       if (!storeId && options?.allowBody) {
         try {
           const body = await request.json();
           storeId = body.storeId;
         } catch {
           // Body parsing failed, continue with null check below
         }
       }
       
       if (!storeId) {
         return { 
           user, 
           store: null, 
           error: NextResponse.json({ 
             error: 'x-store-id header required (or storeId in body if allowBody option enabled)' 
           }, { status: 400 }) 
         };
       }
       
       // Continue with existing store lookup logic (lines 35-111)
       // ... rest of function stays the same
     }
     ```

**2. Fix Store ID Source Mismatch**
   - **Current**: Sync route gets `storeId` from body (line 38)
   - **Current**: `requireStore()` expects `x-store-id` header (line 26 in apiAuth.ts)
   - **Fix**: Standardize on ONE pattern:
     - If using `requireStore()`: Update frontend mutation to send `x-store-id` header
     - If keeping body: Update `requireStore()` to accept body fallback
   - **Location**: `src/features/shopify-integration/hooks/useProducts.ts` (sync mutation, around line 360)

**3. Fix Store Validation Query**
   - **Current**: Two-step check (exists, then is_active) - lines 50-73
   - **Target**: Single query with all conditions
   - **Location**: `src/app/api/shopify/sync/route.ts` (lines 50-73)
   - **Change**: Use `requireStore()` which already does single query, OR combine into one query:
     ```typescript
     // Single query with all conditions
     const { data: store, error: storeError } = await supabase
       .from('stores')
       .select('id, shop_domain, user_id, is_active')
       .eq('id', storeId)
       .eq('user_id', userProfile.id)
       .eq('is_active', true)
       .single();
     ```

**Dependencies**: None (foundational)
**Blocks**: Phase 5 (Image Issues - images come from sync)

---

### Phase 2: Delete Test Pages (CLEANUP - Reduces Confusion)

**Why Second**: Remove confusion before making other changes. No dependencies, but should be done early.

4. **Delete Test Pages**
   - DELETE: `src/app/(app)/products-test/page.tsx` (experimental, causing confusion)
   - DELETE: `src/app/(app)/products-test2/page.tsx` (experimental, causing confusion)
   - Verify no broken imports/references
   - **Action**: 
     ```bash
     rm src/app/(app)/products-test/page.tsx
     rm src/app/(app)/products-test2/page.tsx
     ```
   - **Verification**: Check for any imports referencing these files:
     ```bash
     grep -r "products-test" src/
     ```

**Dependencies**: None
**Blocks**: Phase 4 (Query Key - easier when test pages gone)

---

### Phase 3: Fix React Query Violations (CRITICAL - Fix Data Fetching Pattern)

**Why Third**: Must fix data fetching pattern before optimizing cache keys

5. **Convert Direct Fetch Calls to React Query**
   - **Location**: `src/app/(app)/products/page.tsx`
   - **Current**: `fetchPerformanceData` function (lines 584-624)
   - **Target**: Create `usePerformanceData` hook
   - **Action**: 
     - **CREATE**: `src/features/product-management/hooks/usePerformanceData.ts`
       ```typescript
       import { useQuery } from '@tanstack/react-query';

       export function usePerformanceData(productId: string | null) {
         return useQuery({
           queryKey: ['product-performance', productId],
           queryFn: async () => {
             if (!productId) {
               throw new Error('Product ID is required');
             }

             const response = await fetch(`/api/products/${productId}/performance`);
             
             if (!response.ok) {
               const errorData = await response.json().catch(() => ({}));
               const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
               
               if (response.status === 404) {
                 throw new Error('Product data not found in database. Try syncing your products first.');
               }
               
               throw new Error(`Failed to fetch performance data: ${errorMessage}`);
             }
             
             const result = await response.json();
             
             if (!result.success || !result.data) {
               throw new Error(result.error || 'Failed to fetch performance data');
             }
             
             return result.data;
           },
           enabled: !!productId, // Only run when productId is provided
           staleTime: 2 * 60 * 1000, // 2 minutes
           gcTime: 5 * 60 * 1000, // 5 minutes
           retry: 2,
         });
       }
       ```
     - **UPDATE**: `src/app/(app)/products/page.tsx`
       - **REMOVE**: lines 68-70 (performanceData state)
       - **REMOVE**: lines 584-624 (fetchPerformanceData function)
       - **ADD** import at top (after line 18):
         ```typescript
         import { usePerformanceData } from '@/features/product-management';
         ```
       - **ADD** after line 113 (after useProducts hook):
         ```typescript
         const { 
           data: performanceData, 
           isLoading: loadingPerformance,
           error: performanceError 
         } = usePerformanceData(selectedProductId);
         ```
       - **UPDATE**: `handleViewAnalytics` function (around line 538)
         - **REMOVE**: `fetchPerformanceData(productId);` call
         - React Query hook will automatically fetch when `selectedProductId` changes

6. **Fix Price Update to Use React Query**
   - **Location**: `src/app/(app)/products/page.tsx` (lines 665-708)
   - **Current**: Direct `fetch` call in `handleSaveQuickEdit`
   - **Target**: Use `updateProductPrice` mutation from `useProducts` hook
   - **IMPORTANT**: Update existing `useProducts` call (line 109) to destructure `updateProductPrice`
   - **Action**: 
     - **UPDATE**: line 109 - Add `updateProductPrice` to existing destructuring:
       ```typescript
       // BEFORE (line 109):
       const { products: shopifyProducts, isLoading: productsLoading, error: productsError, syncProducts } = useProducts(selectedStoreId, {
       
       // AFTER (line 109):
       const { 
         products: shopifyProducts, 
         isLoading: productsLoading, 
         error: productsError, 
         syncProducts,
         updateProductPrice  // ADD THIS
       } = useProducts(selectedStoreId, {
       ```
     - **REPLACE**: `handleSaveQuickEdit` function (lines 665-708):
       ```typescript
       const handleSaveQuickEdit = async () => {
         if (!selectedProductId || !editingQuickField || !quickEditValue) return;
         
         const newValue = parseFloat(quickEditValue);
         if (isNaN(newValue) || newValue < 0) {
           toast.error('Please enter a valid price');
           return;
         }

         // Get first variant ID (for price update)
         const selectedProduct = allProducts.find(p => p.id === selectedProductId);
         if (!selectedProduct || !selectedProduct.variants || selectedProduct.variants.length === 0) {
           toast.error('Product variant not found');
           return;
         }
         
         const variantId = selectedProduct.variants[0].id;
         
         if (editingQuickField === 'currentPrice') {
           // Use mutation from useProducts hook
           if (!selectedStoreId) {
             toast.error('Store ID is required');
             return;
           }
           
           const loadingToast = toast.loading('Updating price...');
           
           try {
             await updateProductPrice.mutateAsync({
               storeId: selectedStoreId,
               productId: selectedProductId,
               variantId: variantId,
               price: newValue,
             });
             
             toast.dismiss(loadingToast);
             toast.success('Price updated in Shopify!');
             
             // Update local state
             setProductUpdates(prev => {
               const newMap = new Map(prev);
               const existingUpdates = newMap.get(selectedProductId) || {};
               newMap.set(selectedProductId, { 
                 ...existingUpdates, 
                 currentPrice: newValue 
               });
               return newMap;
             });
             
             // Note: Cache invalidation is handled by mutation onSuccess
             
           } catch (error) {
             toast.dismiss(loadingToast);
             toast.error('Failed to update price', {
               description: error instanceof Error ? error.message : 'Unknown error'
             });
             return;
           }
         } else {
           // For basePrice and maxPrice, just update local state (existing code)
           if (editingQuickField === 'basePrice') {
             setBasePrice(newValue);
           } else if (editingQuickField === 'maxPrice') {
             setMaxPrice(newValue);
           }
         }
         
         setEditingQuickField(null);
         setQuickEditValue('');
       };
       ```

7. **Create Missing Mutation Hooks**
   - **Test Sync**: Create `src/features/shopify-integration/hooks/useTestSync.ts`
     ```typescript
     import { useMutation } from '@tanstack/react-query';

     export function useTestSync() {
       return useMutation({
         mutationFn: async (storeId: string) => {
           const response = await fetch('/api/shopify/test-sync', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ storeId }),
           });

           if (!response.ok) {
             const errorData = await response.json().catch(() => ({}));
             throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
           }

           const result = await response.json();
           
           if (!result.success) {
             throw new Error(result.error || 'Test sync failed');
           }
           
           return result;
         },
       });
     }
     ```
   - **Pricing Run**: Create `src/features/pricing-engine/hooks/usePricingRun.ts`
     ```typescript
     import { useMutation, useQueryClient } from '@tanstack/react-query';
     import { useAuthenticatedFetch } from '@/shared/lib/apiClient';

     export function usePricingRun() {
       const queryClient = useQueryClient();
       const authenticatedFetch = useAuthenticatedFetch();
       
       return useMutation({
         mutationFn: async () => {
           const res = await authenticatedFetch('/api/pricing/run', { 
             method: 'POST' 
           });
           
           const result = await res.json();
           
           if (!res.ok || !result.success) {
             throw new Error(result.error || result.message || 'Pricing run failed');
           }
           
           return result;
         },
         onSuccess: (result) => {
           // Invalidate products query to refetch updated prices
           queryClient.invalidateQueries({ queryKey: ['products'] });
         },
       });
     }
     ```
   - **UPDATE**: `src/app/(app)/products/page.tsx`
     - **ADD** imports at top (after line 18):
       ```typescript
       import { useTestSync } from '@/features/shopify-integration';
       import { usePricingRun } from '@/features/pricing-engine';
       ```
     - **ADD** after useProducts hook (around line 113):
       ```typescript
       const testSync = useTestSync();
       const pricingRun = usePricingRun();
       ```
     - **UPDATE** Test Sync button (lines 929-956):
       ```typescript
       onClick={() => {
         if (!selectedStoreId) {
           toast.error('Please select a store first');
           return;
         }
         
         const loadingToast = toast.loading('Running diagnostics...');
         
         testSync.mutate(selectedStoreId, {
           onSuccess: (result) => {
             toast.dismiss(loadingToast);
             toast.success('Diagnostics passed!', {
               description: `Shopify: ${result.diagnostic.productsInShopify} products, Database: ${result.diagnostic.productsInDatabase}`,
             });
             console.log('📊 Full diagnostic:', result);
           },
           onError: (error) => {
             toast.dismiss(loadingToast);
             toast.error(`Diagnostic failed`, {
               description: error.message || 'Unknown error',
             });
             console.error('❌ Diagnostic error:', error);
           },
         });
       }}
       ```
     - **UPDATE** Run Pricing Now button (lines 801-842):
       ```typescript
       onClick={async () => {
         if (!selectedStoreId) {
           toast.error('Please select a store first');
           return;
         }
         
         const loadingToast = toast.loading('Running pricing algorithm...');
         
         pricingRun.mutate(undefined, {
           onSuccess: (result) => {
             toast.dismiss(loadingToast);
             
             if (result.skipped) {
               toast.info('Pricing algorithm skipped', {
                 description: result.message || 'Global smart pricing is disabled. Enable it to run pricing.',
                 duration: 5000,
               });
             } else {
               const s = result.stats || {};
               if (s.processed === 0) {
                 toast.info('Pricing run completed', {
                   description: result.message || 'No products were processed',
                   duration: 5000,
                 });
               } else {
                 toast.success('Pricing run completed!', {
                   description: `Processed: ${s.processed || 0}, Increased: ${s.increased || 0}, Reverted: ${s.reverted || 0}`,
                   duration: 5000,
                 });
                 // Trigger product sync to get updated prices
                 if (syncProducts) {
                   syncProducts.mutate(selectedStoreId);
                 }
               }
             }
           },
           onError: (error) => {
             toast.dismiss(loadingToast);
             toast.error('Pricing run failed', { 
               description: error.message || 'Unknown error' 
             });
           },
         });
       }}
       ```

**Dependencies**: None (but benefits from Phase 1 - sync route fixed)
**Blocks**: Phase 4 (Query Key - need React Query working correctly first)

---

### Phase 4: Fix Query Key & Remove Double Filtering (PERFORMANCE OPTIMIZATION)

**Why Fourth**: Depends on React Query being used everywhere (Phase 3), and benefits from test pages being deleted (Phase 2)

**Target Store Size**: ~1000 products (including variants)
**Strategy**: Simple Query Key with Client-Side Filtering (Option 1)

8. **Standardize Query Keys to `['products', storeId]` (Option 1 - Optimized for ~1000 products)**
   - **Location**: `src/features/shopify-integration/hooks/useProducts.ts`
   - **Current**: Query key `['products', storeId, filters]` (line 69)
   - **Target**: Query key `['products', storeId]`
   - **Action**: 
     - **CHANGE** line 69:
       ```typescript
       // BEFORE:
       queryKey: ['products', storeId, filters],
       
       // AFTER:
       queryKey: ['products', storeId],
       ```
     - **REMOVE ALL server-side filtering** (lines 115-139):
       - **REMOVE**: `if (filters?.search) query.or(...)` (lines 116-117)
       - **REMOVE**: `if (filters?.vendor) query.eq(...)` (lines 120-121)
       - **REMOVE**: `if (filters?.productType) query.eq(...)` (lines 124-125)
       - **REMOVE**: `if (filters?.status) query.eq(...)` (lines 128-129)
       - **REMOVE**: `if (filters?.tags) query.overlaps(...)` (lines 132-133)
       - **REMOVE**: SortBy and sortOrder filters (lines 136-139)
     - **KEEP ONLY**: 
       ```typescript
       .eq('store_id', storeId)
       .eq('is_active', true)
       ```
     - Fetch ALL products for store once
     - Let client-side filtering handle ALL filtering (already exists in products page, lines 232-350)

9. **Update Cache Invalidation Patterns**
   - **Location**: Multiple files
   - **Sync Mutation**: `src/features/shopify-integration/hooks/useProducts.ts` (line 432)
     ```typescript
     // BEFORE:
     queryClient.invalidateQueries({ queryKey: ['products'] });
     
     // AFTER:
     queryClient.invalidateQueries({ queryKey: ['products', storeId] });
     ```
   - **Update Product Price Mutation**: `src/features/shopify-integration/hooks/useProducts.ts` (line 478)
     ```typescript
     // BEFORE:
     queryClient.invalidateQueries({ queryKey: ['products'] });
     
     // AFTER:
     queryClient.invalidateQueries({ queryKey: ['products', storeId] });
     ```
   - **Products Page**: `src/app/(app)/products/page.tsx` (line 700)
     - **VERIFY**: Already uses `['products', selectedStoreId]` ✅ (should be correct)
   - **Pricing Mutations**: `src/features/pricing-engine/hooks/useSmartPricingMutations.ts`
     - Update all invalidations to use `['products', storeId]` pattern if storeId is available
     - If storeId not available, `['products']` will match all `['products', storeId]` queries (partial match works)
   - **Auth Hooks**: `src/features/auth/hooks/useCurrentStore.ts`
     - Update invalidations to use `['products', storeId]` pattern

**Dependencies**: Phase 2 (test pages deleted), Phase 3 (React Query violations fixed)
**Blocks**: None

---

### Phase 5: Fix Image Issues (DEPENDS ON SYNC ROUTE)

**Why Fifth**: Images come from sync process, so sync route must be fixed first (Phase 1)

10. **Simplify Image Transformation Logic**
    - **Location**: `src/features/shopify-integration/hooks/useProducts.ts` (lines 221-300)
    - **Current**: 80+ lines of complex transformation
    - **Target**: Simplify and add better error logging
    - **Action**: 
      - Simplify image transformation logic
      - Add better error logging instead of silent fallbacks
      - Consider moving transformation to service layer
      - Verify database query selects `images` column (already confirmed ✅ - line 91)

11. **Fix Image Processing**
    - **Location**: Multiple files
    - **Verify**: `src/features/shopify-integration/services/shopifyClient.ts` properly fetches images
    - **Verify**: `src/features/shopify-integration/services/syncProducts.ts` saves images correctly (line 214) ✅
    - **Action**: Test end-to-end image flow

**Dependencies**: Phase 1 (sync route must work correctly to get images)
**Blocks**: None

---

### Phase 6: Standardize Naming and Patterns (CLEANUP - Should Be Last)

**Why Last**: Cleanup/standardization should happen after all critical fixes are done

12. **Standardize Field Naming**
    - Create transformation utilities
    - Document naming conventions
    - Update inconsistent code

13. **Standardize Error Messages**
    - Create error message constants
    - Use consistent format
    - Include helpful context

**Dependencies**: All previous phases (should be done after everything else)
**Blocks**: None

---

## EXACT FILE LOCATIONS & LINE NUMBERS (VERIFIED)

**Phase 1 - Data Integrity & Sync Route**:
- React Key Fix: `src/app/(app)/products/page.tsx` **line 1183**
- Sync Route Auth: `src/app/api/shopify/sync/route.ts` **line 16** (POST function starts here)
- useProducts Filter: `src/features/shopify-integration/hooks/useProducts.ts` **lines 182-187**
- Sync Upsert: `src/features/shopify-integration/services/syncProducts.ts` **line 230-234**
- ID Normalizer: `src/shared/utils/shopifyIdNormalizer.ts` **line 14** (function starts)

**Phase 3 - React Query Violations**:
- fetchPerformanceData: `src/app/(app)/products/page.tsx` **lines 584-624**
- Price Update Fetch: `src/app/(app)/products/page.tsx` **lines 665-708** (handleSaveQuickEdit function)
- Pricing Run Fetch: `src/app/(app)/products/page.tsx` **lines 807-842** (Run Pricing Now button onClick)
- Test Sync Fetch: `src/app/(app)/products/page.tsx` **lines 929-956** (Test Sync button onClick)
- Existing useProducts call: `src/app/(app)/products/page.tsx` **line 109**

**Phase 4 - Query Key**:
- Query Key Definition: `src/features/shopify-integration/hooks/useProducts.ts` **line 69**
- Server-Side Filtering: `src/features/shopify-integration/hooks/useProducts.ts` **lines 115-139**
- Cache Invalidation Sync: `src/features/shopify-integration/hooks/useProducts.ts` **line 432**
- Cache Invalidation Update Price: `src/features/shopify-integration/hooks/useProducts.ts` **line 478**
- Cache Invalidation Products Page: `src/app/(app)/products/page.tsx` **line 700**
- Cache Invalidation Pricing: `src/features/pricing-engine/hooks/useSmartPricingMutations.ts` **lines 34, 73, 132, 180, 219, 256**

---

## FINAL VERIFICATION CHECKLIST

Before executing, verify:

- [ ] All SQL queries tested in Supabase SQL Editor (run PREVIEW queries first)
- [ ] All line numbers verified in actual codebase
- [ ] All code snippets copy-pasted correctly
- [ ] All imports added correctly
- [ ] All hooks created and exported properly
- [ ] All file paths verified to exist
- [ ] No TypeScript errors after changes
- [ ] No broken imports or references
- [ ] Browser console shows no React key errors
- [ ] Sync button works without "Store not found" errors
- [ ] Products display with images
- [ ] Filtering is instant (no loading spinners)
- [ ] All React Query hooks are working

---

## PLAN STATUS: READY FOR EXECUTION ✅

The plan is now:
- ✅ **Complete**: All phases defined with exact steps
- ✅ **Detailed**: Exact line numbers, code snippets, SQL queries
- ✅ **Self-contained**: Can be executed in new chat with no context
- ✅ **Verified**: All file paths, endpoints, and exports confirmed
- ✅ **Bulletproof**: Copy-paste ready code, no ambiguity
- ✅ **Safe**: Backup steps, rollback procedures, testing instructions

**READY TO EXECUTE** 🚀

