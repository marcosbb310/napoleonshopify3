# Next Steps: Variant-Level Pricing

## Current Status ✅

**Completed:**
- ✅ Phases 1-3: Database migrations complete
- ✅ Algorithm updated to process variants
- ✅ Sync products updated to populate variant prices
- ✅ `last_smart_pricing_price` updates on every increase

**Remaining:**
- ⏳ Phase 3.4: Immediate 5% increase on toggle ON
- ⏳ Phase 4: Frontend updates
- ⏳ Phase 5: Testing

---

## Next Phase: Critical Bug Fixes

The toggle handlers still query `products` table when they should query `product_variants`. This needs to be fixed **before** testing.

### Issue: Toggle handlers work on products, not variants

**Files affected:**
1. `src/app/api/pricing/config/[productId]/route.ts` - Individual toggle
2. `src/app/api/pricing/resume/route.ts` - Resume individual
3. `src/app/api/pricing/global-resume/route.ts` - Resume global

**Problem:** These files query `products` table and update `product_id` in configs. They need to:
1. Query `product_variants` instead
2. Update `variant_id` instead of `product_id`
3. Add immediate 5% increase on enable

---

## Step-by-Step: Fix Toggle Handlers

### Option 1: Quick Fix (Recommended)
**What:** Keep API structure the same, but make them work with variants behind the scenes

**Approach:**
- API still accepts `productId` parameter
- Internally look up the first variant of that product
- Work with variant_id for all operations

### Option 2: Full Migration
**What:** Change API to use `variantId` parameter

**Approach:**
- Change API endpoints to accept `variantId`
- Update frontend to pass variant IDs
- More work but cleaner architecture

---

## Immediate Action Needed

**Recommendation:** Since migrations are complete and working on variants, we need to either:

1. **Run comprehensive tests** to see what breaks
2. **Fix toggle handlers** to work with variants
3. **Then test everything**

---

## Your Decision

**What would you like to do next?**

**Option A:** Test first, then fix issues as they come up
- Pros: See actual behavior, fix what breaks
- Cons: Might run into errors during testing

**Option B:** Fix toggle handlers first, then test
- Pros: Cleaner experience, fewer errors
- Cons: More upfront work

**Option C:** Something else?

---

## Testing Checklist (When Ready)

Based on "November 1st pricing engine and syncing fixes.md":

### Phase 2: Test Pricing Algorithm ✅ (Ready)
- Test "Run Pricing Now" button
- Verify it processes variants
- Check Shopify prices updated
- Verify database records

### Phase 3: Diagnose Sync Issue
- Make change in Shopify
- Click "Sync Products"
- Verify app shows updated price

### Phase 6: Test Global Toggle ⚠️ (Needs fixes)
- Turn global smart pricing ON
- Check database
- Turn OFF and verify

---

## Recommendation

**I recommend Option A: Test First**

Why:
1. We can see what actually breaks
2. Algorithm already works with variants
3. We can fix issues as we find them
4. Faster to get to working state

**Next command:** Tell me you want to test, and I'll guide you through running the pricing algorithm!

