# Pricing Engine End-to-End Testing & Implementation Plan

## Overview

This is a comprehensive testing plan to verify the pricing engine works correctly with bidirectional data sync between the app, Supabase database, and Shopify store.

**Total Estimated Time:** ~2 hours  
**Phases:** 8 sequential phases  
**Starting Point:** You already have products visible in the UI

**File Location:** `November 1st pricing engine and syncing fixes.md`  
**When to reference this plan:** In a new chat conversation, say "Please reference November 1st pricing engine and syncing fixes.md and execute Phase [X]"

---

## Context & Current State

### What's Working ✅
1. **OAuth & Store Connection** - Users can connect Shopify stores via OAuth
2. **Initial Product Display** - Products appear in UI (synced at some point in the past)
3. **Pricing Algorithm Code** - `runPricingAlgorithm()` exists in `src/features/pricing-engine/services/pricingAlgorithm.ts`
4. **Smart Pricing UI** - Global and individual product toggles are present
5. **Manual Test Button** - "Run Pricing Now" button exists for development testing

### Known Issues ⚠️
1. **Sync button appears to work but updates don't show** - When clicking "Sync Products", no errors occur, but changes made in Shopify don't reflect in the app
2. **Manual price edits don't sync to Shopify** - Editing prices in the analytics panel only updates local React state
3. **Pricing algorithm hasn't been tested end-to-end** - Unknown if it actually updates Shopify prices

### Goal
Verify the complete data flow: **App ↔ Supabase ↔ Shopify** works in both directions, and identify/fix any broken links in the chain.

---

## Phase 1: Environment Setup & Verification (5 min)

### Objective
Ensure the development environment is ready and capture baseline state before testing.

### Steps

1. **Start dev server**
   ```bash
   cd /Users/marcosbb310/Desktop/code/napoleonshopify3
   npm run dev
   ```

2. **Navigate to products page**
   - Open browser to `http://localhost:3000/products`
   - Ensure you're logged in
   - Verify a store is selected in the dropdown (if multiple stores exist)

3. **Document current state**
   - Count how many products are visible in the UI
   - Note 3 specific products and their current prices (write them down)
   - Open browser DevTools (F12) → Console tab
   - Open browser DevTools → Network tab

4. **Verify Shopify admin access**
   - Open Shopify admin in another tab
   - Navigate to Products section
   - Verify you can see the same products
   - Note the prices of the same 3 products you documented

5. **Check database access**
   - Open Supabase dashboard
   - Navigate to Table Editor
   - Verify these tables exist:
     - `stores`
     - `products`
     - `product_variants`
     - `pricing_config`
     - `pricing_history`
     - `global_settings`

### Expected State After Phase 1
- ✅ Dev server running on localhost:3000
- ✅ Products visible in UI
- ✅ Browser DevTools open and ready
- ✅ Shopify admin accessible
- ✅ Database tables confirmed to exist
- ✅ Baseline prices documented for comparison

---

## Phase 2: Test Pricing Algorithm (App → Shopify) (20 min)

### Objective
Verify that the pricing algorithm can successfully update prices in Shopify and that changes flow through the entire system.

### Test 2.1: Enable Smart Pricing for Test Products

**Steps:**
1. In the app UI, locate one of the 3 products you documented
2. Click on the product card to open the analytics panel
3. Find the "Smart Pricing" toggle at the top of the panel
4. Turn the toggle **ON**
5. If a modal appears asking about price options, select "Use Base Prices"
6. Close the analytics panel
7. Repeat for the other 2 test products

**Expected Result:**
- ✅ Toggle switches to ON state
- ✅ No errors in console
- ✅ Toast notification confirms action

**What to log:**
```
Product 1: [Name] - Smart Pricing: ON
Product 2: [Name] - Smart Pricing: ON  
Product 3: [Name] - Smart Pricing: ON
```

### Test 2.2: Run Pricing Algorithm Manually

**Steps:**
1. Locate the "Run Pricing Now" button (near the top of the page, blue button)
2. Open browser console (F12) to watch for logs
3. Click "Run Pricing Now"
4. Wait for the process to complete (watch for toast notification)
5. Note the statistics shown in the toast (processed, increased, reverted counts)

**Expected Result:**
- ✅ Toast shows "Pricing run completed!"
- ✅ Statistics show at least 3 products processed
- ✅ Console shows algorithm execution logs
- ✅ No error messages

**What to log:**
```
Algorithm Stats:
- Processed: [X]
- Increased: [Y]
- Reverted: [Z]
- Console errors: [None/List any]
```

### Test 2.3: Verify Shopify Prices Updated

**Steps:**
1. Switch to Shopify admin tab
2. Refresh the Products page
3. Check the 3 test products
4. Compare prices to your baseline documentation
5. Calculate the percentage change

**Expected Result:**
- ✅ Prices increased by approximately 5%
- ✅ All 3 products updated
- ✅ Changes visible immediately in Shopify

**What to log:**
```
Product 1: $[old] → $[new] ([X]% increase)
Product 2: $[old] → $[new] ([X]% increase)
Product 3: $[old] → $[new] ([X]% increase)
```

**If prices did NOT update:**
- ❌ Check server console for errors
- ❌ Check browser console for API errors
- ❌ Verify Shopify access token is valid
- ❌ Check `pricing_config` table to confirm `auto_pricing_enabled = true`
- **STOP HERE and debug before continuing**

### Test 2.4: Verify Database Updated

**Steps:**
1. Go to Supabase dashboard
2. Open `products` table
3. Find your 3 test products (search by title)
4. Check the `current_price` column
5. Open `pricing_history` table
6. Filter by recent timestamp (today)
7. Verify entries exist for your 3 products

**Expected Result:**
- ✅ `products.current_price` matches Shopify prices
- ✅ `pricing_history` has 3 new entries
- ✅ History entries show `action = 'increase'`
- ✅ `old_price` and `new_price` values are correct

**What to log:**
```
Database Verification:
- products.current_price: [Matches Shopify? Yes/No]
- pricing_history entries: [3 found? Yes/No]
- History data accurate: [Yes/No]
```

### Test 2.5: Verify App UI Updates

**Steps:**
1. Return to the app UI (products page)
2. **Do NOT manually refresh the page**
3. Wait 5 seconds for React Query to refetch
4. Check if the 3 product prices updated in the UI
5. If not updated, click "Sync Products" button
6. Check again if prices updated

**Expected Result:**
- ✅ Prices update automatically (React Query refetch)
- OR ✅ Prices update after clicking "Sync Products"

**What to log:**
```
UI Update Status:
- Auto-updated (no manual action): [Yes/No]
- Updated after sync button: [Yes/No]
- Prices match Shopify: [Yes/No]
```

**If UI did NOT update even after sync:**
- ❌ This confirms the sync issue
- ❌ Continue to Phase 3 to diagnose

### Phase 2 Success Criteria
- ✅ Algorithm runs without errors
- ✅ Shopify prices update correctly
- ✅ Database records changes
- ✅ UI reflects changes (either automatically or after manual sync)

---

## Phase 3: Diagnose Sync Issue (Shopify → App) (30 min)

### Objective
Identify exactly where the sync process fails when trying to update the app with changes from Shopify.

### Test 3.1: Add Diagnostic Logging

**IMPORTANT:** Before starting, verify these files exist:
- `src/features/shopify-integration/hooks/useProducts.ts` (should exist)
- `src/app/api/shopify/sync/route.ts` (should exist)

**Steps:**
1. Open `src/features/shopify-integration/hooks/useProducts.ts`
2. Find the `syncProducts` mutation function starting at line 184
3. **IMPORTANT:** Note there's already a `console.log` at line 186, so ADD MORE logs after it
4. Add additional console logs inside the mutation:

```typescript
const syncProducts = useMutation({
  mutationFn: async (storeId: string) => {
    console.log('🔵 SYNC MUTATION: Started with storeId:', storeId);
    
    const response = await fetch('/api/shopify/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId }),
    });

    console.log('🔵 SYNC MUTATION: Response status:', response.status);
    
    const result = await response.json();
    console.log('🔵 SYNC MUTATION: Result:', result);

    if (!result.success) {
      throw new Error(result.error || 'Product sync failed');
    }

    return result;
  },
  onSuccess: (data) => {
    console.log('🔵 SYNC MUTATION: onSuccess called with:', data);
    toast.success('Products synced successfully!');
    queryClient.invalidateQueries({ queryKey: ['products'] });
    console.log('🔵 SYNC MUTATION: Invalidated queries');
  },
  onError: (error) => {
    console.log('🔵 SYNC MUTATION: onError called with:', error);
    toast.error(`Product sync failed: ${error.message}`);
  },
});
```

4. Open `src/app/api/shopify/sync/route.ts`
5. Find the `POST` function starting at line 16
6. Add console logs at the beginning (AFTER line 16, before existing code):

```typescript
export async function POST(request: NextRequest) {
  console.log('🟢 SYNC API: Request received');
  try {
    console.log('🟢 SYNC API: Inside try block');
    // ... existing code continues
```

**IMPORTANT:** Don't remove existing code, just add logs before it.

7. Save both files
8. Restart the dev server (Ctrl+C, then `npm run dev`)

### Test 3.2: Make a Change in Shopify

**Steps:**
1. Go to Shopify admin
2. Select one of your test products
3. Change the price (e.g., add $5 to the current price)
4. Save the product
5. Note the new price

**What to log:**
```
Shopify Change:
- Product: [Name]
- Old Price: $[X]
- New Price: $[Y]
- Time: [timestamp]
```

### Test 3.3: Trigger Sync and Watch Logs

**Steps:**
1. Return to app UI
2. Open browser console (clear previous logs)
3. Open Network tab
4. Click "Sync Products" button
5. Watch console logs carefully
6. Watch Network tab for API requests

**Expected Logs Sequence:**
```
🔵 SYNC MUTATION: Started with storeId: [uuid]
🟢 SYNC API: Request received
🟢 SYNC API: Auth check - Authenticated
🟢 SYNC API: Request body: { storeId: "[uuid]" }
🟢 SYNC API: Store ID: [uuid]
🔵 SYNC MUTATION: Response status: 200
🔵 SYNC MUTATION: Result: { success: true, data: {...} }
🔵 SYNC MUTATION: onSuccess called with: [data]
🔵 SYNC MUTATION: Invalidated queries
```

**What to log:**
```
Console Log Analysis:
- Mutation started: [Yes/No]
- API received request: [Yes/No]
- Auth passed: [Yes/No]
- Response status: [200/other]
- Success: [true/false]
- onSuccess called: [Yes/No]
- Queries invalidated: [Yes/No]
```

**Network Tab Analysis:**
```
Network Request:
- Endpoint: /api/shopify/sync
- Method: POST
- Status: [code]
- Response time: [ms]
- Response body: [paste JSON]
```

### Test 3.4: Check if Data Reached Database

**Steps:**
1. Go to Supabase dashboard
2. Open `products` table
3. Find the product you changed in Shopify
4. Check the `current_price` column
5. Check the `updated_at` timestamp

**Expected Result:**
- ✅ `current_price` matches the new Shopify price
- ✅ `updated_at` timestamp is recent (within last minute)

**What to log:**
```
Database Check:
- Product found: [Yes/No]
- current_price: $[X]
- Matches Shopify: [Yes/No]
- updated_at: [timestamp]
- Is recent: [Yes/No]
```

### Test 3.5: Check React Query Cache

**Steps:**
1. In browser console, type:
```javascript
// Check React Query DevTools
window.__REACT_QUERY_DEVTOOLS__ = true;
```

2. Or manually check the products data:
```javascript
// In console after sync
console.log('Current products in state:', 
  document.querySelector('[data-product-id]')?.getAttribute('data-product-id')
);
```

3. Force a hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
4. Check if the price updates after hard refresh

**Expected Result:**
- ✅ Hard refresh shows updated price
- This indicates React Query cache is stale

**What to log:**
```
Cache Investigation:
- Price updates after hard refresh: [Yes/No]
- React Query working: [Yes/No]
```

### Phase 3 Success Criteria
- ✅ Identified exact failure point in sync process
- ✅ Console logs show where it breaks
- ✅ Confirmed if database was updated
- ✅ Confirmed if UI cache is the issue

---

## Phase 4: Fix Identified Issues (time varies)

### Objective
Implement fixes based on what was discovered in Phase 3.

### Common Issues & Fixes

#### Issue 1: Products Not Updating in Database
**Symptoms:** Shopify data fetched but database unchanged

**Fix:** Check the upsert operation in `src/features/shopify-integration/services/syncProducts.ts`
- Verify `ON CONFLICT` clause is correct
- Check if `store_id,shopify_id` is the correct conflict target
- Ensure `ignoreDuplicates: false` is set

#### Issue 2: React Query Not Refetching
**Symptoms:** Database updated but UI unchanged until hard refresh

**Fix:** In `src/features/shopify-integration/hooks/useProducts.ts`, verify:
- `queryClient.invalidateQueries({ queryKey: ['products'] })` is called
- Query key includes `storeId` in the key array
- `staleTime` and `gcTime` are reasonable values

#### Issue 3: Wrong Store ID Being Used
**Symptoms:** Data appears to be from wrong store

**Fix:** Verify `selectedStoreId` state is correctly set in UI and passed to hooks

#### Issue 4: Authentication Issues
**Symptoms:** 401 or 403 errors in logs

**Fix:** Check that session is valid and RLS policies allow updates

---

## Phase 5: Implement Manual Price Edit API (15 min)

### Objective
Create the missing API endpoint that allows manual price edits to sync to Shopify.

### Implementation Steps

1. **Create the API endpoint**

**IMPORTANT:** The folder structure needs to be created first:
- The directory `src/app/api/shopify/products/` exists
- Create subfolder: `src/app/api/shopify/products/[productId]/`
- Inside that, create: `src/app/api/shopify/products/[productId]/price/`
- Then create the file: `src/app/api/shopify/products/[productId]/price/route.ts`

**Command to create directories:**
```bash
mkdir -p src/app/api/shopify/products/\[productId\]/price
touch src/app/api/shopify/products/\[productId\]/price/route.ts
```

Then open the new file and paste this code:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';
import { getDecryptedTokens } from '@/features/shopify-oauth/services/tokenService';

/**
 * PUT /api/shopify/products/[productId]/price
 * 
 * Updates product price in both Shopify and Supabase
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    // Authenticate and get store
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const { productId } = await params;
    const body = await request.json();
    const { price, variantId } = body;

    if (!price || typeof price !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Valid price is required' },
        { status: 400 }
      );
    }

    // Get decrypted access token
    const tokens = await getDecryptedTokens(store.id);

    // Update Shopify
    const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
    const baseUrl = `https://${store.shop_domain}/admin/api/${apiVersion}`;
    
    // If no variantId provided, get it from product
    let actualVariantId = variantId;
    if (!actualVariantId) {
      const productRes = await fetch(`${baseUrl}/products/${productId}.json`, {
        headers: { 'X-Shopify-Access-Token': tokens.accessToken },
        cache: 'no-store',
      });
      
      if (!productRes.ok) {
        throw new Error(`Failed to fetch product: ${productRes.statusText}`);
      }
      
      const productData = await productRes.json();
      actualVariantId = productData.product?.variants?.[0]?.id;
      
      if (!actualVariantId) {
        throw new Error('No variant found for product');
      }
    }

    // Update variant price in Shopify
    const updateRes = await fetch(`${baseUrl}/variants/${actualVariantId}.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': tokens.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        variant: { 
          id: actualVariantId, 
          price: price.toFixed(2),
          compare_at_price: null,
        },
      }),
      cache: 'no-store',
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      throw new Error(`Shopify update failed: ${errorText}`);
    }

    // Update Supabase database
    const supabase = createAdminClient();
    
    // Find product by Shopify ID
    const { data: dbProduct } = await supabase
      .from('products')
      .select('id')
      .eq('store_id', store.id)
      .eq('shopify_id', productId)
      .single();

    if (!dbProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found in database' },
        { status: 404 }
      );
    }

    // Update product price in database
    const { error: updateError } = await supabase
      .from('products')
      .update({ current_price: price })
      .eq('id', dbProduct.id);

    if (updateError) {
      console.error('Failed to update database:', updateError);
      // Don't fail the request - Shopify was updated successfully
    }

    // Update variant price in database
    const { error: variantUpdateError } = await supabase
      .from('product_variants')
      .update({ price: price.toString() })
      .eq('product_id', dbProduct.id)
      .eq('shopify_id', actualVariantId);

    if (variantUpdateError) {
      console.error('Failed to update variant:', variantUpdateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Price updated successfully',
      data: { price, productId, variantId: actualVariantId },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Price update error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
```

2. **Update the UI to call this API**

In `src/app/(app)/products/page.tsx`, update the `handleSaveQuickEdit` function:

**First, ADD the import at the top of the file (around line 3-40):**
- Add this line with the other React imports: `import { useQueryClient } from '@tanstack/react-query';`
- This file does NOT currently have this import, so it MUST be added

**Then find `handleSaveQuickEdit` starting around line 651:**
- Replace the ENTIRE function with this version (it adds API call):

```typescript
const handleSaveQuickEdit = async () => {
  if (!editingQuickField || !selectedProductId || !selectedStoreId) return;
  
  const newValue = parseFloat(quickEditValue);
  if (isNaN(newValue) || newValue <= 0) {
    toast.error('Invalid price', { description: 'Please enter a valid positive number' });
    return;
  }

  // Show loading toast
  const loadingToast = toast.loading('Updating price...');

  try {
    // Call API to update Shopify and database
    const response = await fetch(`/api/shopify/products/${selectedProductId}/price`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        price: newValue,
        field: editingQuickField 
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to update price');
    }

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

    setEditingQuickField(null);
    
    // Invalidate queries to refetch from database
    queryClient.invalidateQueries({ queryKey: ['products', selectedStoreId] });
    
  } catch (error) {
    toast.dismiss(loadingToast);
    toast.error('Failed to update price', {
      description: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
```

**IMPORTANT:** After adding the import, also add the hook call inside the component:
- Find line 72-73 where `useStores()` and `authenticatedFetch` are called
- Add this line there: `const queryClient = useQueryClient();`
- This creates the queryClient instance needed for cache invalidation

3. **Test the implementation**

**Steps:**
1. Save the files
2. Restart dev server
3. Go to products page
4. Open a product's analytics panel
5. Click edit on "Current Price"
6. Change the price
7. Save
8. Verify in Shopify admin that price updated
9. Verify in Supabase that `current_price` updated
10. Verify UI shows new price

**Expected Result:**
- ✅ All three systems (Shopify, Supabase, App) show updated price
- ✅ Toast shows "Price updated in Shopify!"
- ✅ No errors in console

---

## Phase 6: Test Global Smart Pricing Toggle (10 min)

### Objective
Verify that the global smart pricing toggle works correctly and integrates with scheduled tasks.

### Test 6.1: Turn Global Smart Pricing ON

**Steps:**
1. In the app UI, find the "Global Smart Pricing" power button
2. Click to turn it ON (should show a confirmation dialog)
3. Select appropriate options in the dialog
4. Note the number of products enabled

**Expected Result:**
- ✅ Confirmation dialog appears
- ✅ All products get `auto_pricing_enabled = true`
- ✅ Toast confirms action
- ✅ `global_settings.smart_pricing_global_enabled = true` in database

### Test 6.2: Verify Configuration in Database

**Steps:**
1. Go to Supabase dashboard
2. Open `global_settings` table
3. Check `smart_pricing_global_enabled` value
4. Open `pricing_config` table
5. Count how many rows have `auto_pricing_enabled = true`

**Expected Result:**
- ✅ Global setting is true
- ✅ All products have pricing config enabled

### Test 6.3: Turn Global Smart Pricing OFF

**Steps:**
1. Click "Global Smart Pricing" power button to OFF
2. Confirm the action
3. Note the number of products affected

**Expected Result:**
- ✅ Confirmation dialog appears (may warn about reverting prices)
- ✅ All products get `auto_pricing_enabled = false`
- ✅ Toast confirms action
- ✅ `global_settings.smart_pricing_global_enabled = false`

### Test 6.4: Verify Algorithm Respects Global Toggle

**Steps:**
1. Turn global smart pricing OFF
2. Click "Run Pricing Now"
3. Note the statistics in the toast

**Expected Result:**
- ✅ Algorithm runs but reports "Global smart pricing is disabled"
- ✅ No products are processed

### Phase 6 Success Criteria
- ✅ Global toggle controls all products
- ✅ Database updates correctly
- ✅ Algorithm respects global state
- ✅ Toggle persists across sessions

---

## Phase 7: Test Trigger.dev Integration (10 min)

### Objective
Verify that scheduled pricing tasks work correctly with Trigger.dev.

### Test 7.1: Check Trigger.dev Configuration

**Steps:**
1. Open `src/trigger/daily-pricing.ts`
2. Verify the cron schedule is set
3. Check that it calls `runPricingAlgorithm`
4. **For Trigger.dev dashboard access:**
   - If you have Trigger.dev account: Log in and check dashboard
   - If no access: Skip dashboard checks, focus on code verification
   - Check terminal logs when dev server runs

**Expected Result:**
- ✅ Cron schedule is `0 2 * * *` (2 AM UTC daily)
- ✅ Task exists in Trigger.dev dashboard (if accessible)
- ✅ Code is properly structured

### Test 7.2: Manual Trigger Test

**Steps:**
1. **If you have Trigger.dev dashboard access:**
   - Find the "daily-pricing-optimization" task in dashboard
   - Click "Trigger Now" or "Test Run"
   - Watch the logs for execution
2. **If NO dashboard access:**
   - Skip this test OR manually call the algorithm using "Run Pricing Now" button
   - This tests the same code path
3. Check if prices updated in Shopify

**Expected Result:**
- ✅ Task runs successfully
- ✅ Logs show algorithm execution
- ✅ Statistics show processed products
- ✅ Shopify prices updated

### Test 7.3: Verify Global Toggle Integration

**Steps:**
1. Turn global smart pricing ON
2. Trigger the scheduled task manually (via Trigger.dev dashboard OR use "Run Pricing Now" button)
3. Note the results
4. Turn global smart pricing OFF
5. Trigger the task again
6. Note the results

**Expected Result:**
- ✅ When ON: Task processes products
- ✅ When OFF: Task returns early with "Global smart pricing is disabled"

### Phase 7 Success Criteria
- ✅ Scheduled tasks run on schedule
- ✅ Tasks respect global toggle state
- ✅ Tasks update Shopify and database
- ✅ Logs are comprehensive

---

## Phase 8: Final End-to-End Test (15 min)

### Objective
Run through all major flows one final time to ensure everything works together.

### Test Scenario: Complete User Flow

**Setup:**
1. Pick 5 products at random
2. Document their current prices
3. Turn ON global smart pricing
4. Turn OFF smart pricing for 2 of the products (individual toggles)

**Execute:**

1. **Run pricing algorithm**
   - Click "Run Pricing Now"
   - Note: Should process 3 products (5 total - 2 with individual toggles OFF)
   - Verify prices in Shopify updated for those 3 products

2. **Make manual price change**
   - Open analytics panel for 1 product
   - Edit "Current Price" to a new value
   - Save
   - Verify all 3 systems updated

3. **Make change in Shopify**
   - Change price of 1 product in Shopify admin
   - Click "Sync Products" in app
   - Verify app shows updated price

4. **Toggle smart pricing off**
   - Turn global smart pricing OFF
   - Verify all products have smart pricing disabled
   - Click "Run Pricing Now"
   - Verify no products processed

5. **Turn it back on**
   - Turn global smart pricing ON
   - Choose to resume (not use base prices)
   - Run pricing algorithm again
   - Verify products processed

**Expected Result:**
- ✅ All flows work correctly
- ✅ Data consistent across all systems
- ✅ No errors or unexpected behavior
- ✅ UI is responsive and accurate

---

## Success Criteria Summary

### Must Have ✅
- ✅ Products sync bidirectionally (Shopify ↔ App)
- ✅ Smart pricing algorithm updates Shopify prices
- ✅ Manual price edits sync to Shopify
- ✅ Global toggle controls all products
- ✅ Individual toggle works per product
- ✅ Database stays in sync with Shopify
- ✅ UI reflects changes immediately
- ✅ Scheduled tasks respect global toggle

### Nice to Have 🎯
- [ ] Webhook integration for real-time updates
- [ ] Bulk operations optimized
- [ ] Detailed error recovery mechanisms
- [ ] Comprehensive logging/analytics dashboard
- [ ] Performance metrics and monitoring

---

## Next Steps After Testing

1. **Document findings**
   - Create a summary of what worked and what didn't
   - List any bugs or issues found
   - Note any performance concerns

2. **Fix any remaining issues**
   - Implement fixes for bugs found
   - Optimize any slow operations
   - Add missing error handling

3. **Add automated tests**
   - Write unit tests for pricing algorithm
   - Write integration tests for API routes
   - Add E2E tests for critical user flows

4. **Deploy to staging**
   - Test in staging environment
   - Verify with production-like data
   - Monitor for issues

5. **Production rollout**
   - Deploy to production
   - Monitor Trigger.dev tasks
   - Watch for errors in logs
   - Collect user feedback

---

## Troubleshooting Guide

### Sync Not Working
1. Check if `selectedStoreId` is undefined
2. Verify store exists in `stores` table
3. Check if access token is valid
4. Look for RLS policy blocking updates
5. Verify `ON CONFLICT` clause in upsert

### Algorithm Not Running
1. Check if global toggle is ON
2. Verify products have `auto_pricing_enabled = true`
3. Check if Shopify access token works
4. Look for errors in server console
5. Verify `runPricingAlgorithm` is being called

### Price Updates Not Showing
1. Check React Query cache invalidation
2. Verify database was updated
3. Force hard refresh (Ctrl+Shift+R)
4. Check Network tab for API responses
5. Look for JavaScript errors in console

### Database Out of Sync
1. Run sync manually to force update
2. Check for constraint violations
3. Verify store_id and shopify_id matching
4. Look for transaction errors
5. Check Supabase logs

---

## Notes

- This plan assumes products already exist in the UI
- If no products are visible, start with Phase 3 (sync debugging)
- All phases should be completed in order
- Document findings as you go
- Take screenshots of any errors
- Save console logs for debugging
