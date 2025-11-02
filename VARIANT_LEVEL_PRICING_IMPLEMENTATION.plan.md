# Variant-Level Smart Pricing Implementation Plan

## Executive Summary

Transform the pricing engine from product-level to variant-level pricing by linking `pricing_config` to variants instead of products. Each variant will be treated as an independent pricing entity.

**Critical Discovery**: The current `product_variants` table definition in `fix-products-table.sql` does NOT include `store_id`, but the code in `syncProducts.ts` assumes it exists. This must be resolved.

## Phase 1: Database Schema Migration

### Step 1.1: Verify Current Schema

**Action**: Check if `product_variants` table exists and has `store_id` column

```sql
-- Run in Supabase SQL Editor
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'product_variants'
ORDER BY ordinal_position;
```

### Step 1.2: Add store_id to product_variants if Missing

**File**: `supabase/migrations/020_add_variant_store_id.sql`

Create this file with the following content:

```sql
-- Add store_id to product_variants table
-- This migration ensures product_variants has store_id for multi-store support

BEGIN;

-- Add store_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'product_variants' 
    AND column_name = 'store_id'
  ) THEN
    ALTER TABLE public.product_variants ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;
    
    -- Backfill store_id from parent product
    UPDATE public.product_variants pv
    SET store_id = p.store_id
    FROM public.products p
    WHERE pv.product_id = p.id
      AND pv.store_id IS NULL;
    
    -- Make store_id NOT NULL after backfill
    ALTER TABLE public.product_variants ALTER COLUMN store_id SET NOT NULL;
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_product_variants_store_id ON public.product_variants(store_id);
    
    -- Add composite unique constraint for store_id + product_id + shopify_id
    ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_shopify_id_key;
    ALTER TABLE public.product_variants 
      ADD CONSTRAINT product_variants_store_product_shopify_unique 
      UNIQUE (store_id, product_id, shopify_id);
  END IF;
END $$;

COMMIT;
```

**Action**: Run this migration in Supabase SQL Editor

### Step 1.3: Create Variant-Level Pricing Migration

**File**: `supabase/migrations/021_variant_level_pricing.sql`

Create this file with the following content:

```sql
-- Migrate pricing configuration from product-level to variant-level
-- This allows each variant to have independent smart pricing

BEGIN;

-- 1. Add variant_id to pricing_config
ALTER TABLE pricing_config
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_pricing_config_variant_id ON pricing_config(variant_id);

-- 2. Make product_id nullable (for backward compatibility during transition)
ALTER TABLE pricing_config
  ALTER COLUMN product_id DROP NOT NULL;

-- 3. Add starting_price and current_price to product_variants
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS starting_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS current_price DECIMAL(10, 2);

-- 4. Backfill starting_price from price column (current Shopify price)
UPDATE product_variants
SET starting_price = price::DECIMAL(10, 2),
    current_price = price::DECIMAL(10, 2)
WHERE starting_price IS NULL OR current_price IS NULL;

-- 5. Make prices NOT NULL after backfill
ALTER TABLE product_variants
  ALTER COLUMN starting_price SET NOT NULL,
  ALTER COLUMN current_price SET NOT NULL;

-- 6. Add comments for documentation
COMMENT ON COLUMN pricing_config.variant_id IS 'Links pricing config to a specific variant. Each variant has independent smart pricing.';
COMMENT ON COLUMN product_variants.starting_price IS 'Price from Shopify when variant was first synced (baseline for reverting)';
COMMENT ON COLUMN product_variants.current_price IS 'Current price of variant (may be different from starting_price due to smart pricing)';

-- 7. Update unique constraint on pricing_config
-- Drop old constraint if exists
ALTER TABLE pricing_config DROP CONSTRAINT IF EXISTS pricing_config_product_id_key;
-- Add new constraint for variant_id (can only have one config per variant)
ALTER TABLE pricing_config 
  ADD CONSTRAINT pricing_config_variant_unique UNIQUE (variant_id);

COMMIT;
```

**Action**: Run this migration in Supabase SQL Editor

### Step 1.4: Update syncProducts.ts to Populate Variant Prices

**File**: `src/features/shopify-integration/services/syncProducts.ts`

**Location**: Lines 205-221 (in the `processProductVariants` function)

**Current Code**:
```typescript
const variantsToUpsert = variants.map(variant => ({
  store_id: storeId,
  product_id: productDbId,
  shopify_id: variant.id,
  title: variant.title,
  price: variant.price.toString(),
  compare_at_price: variant.compareAtPrice?.toString() || null,
  sku: variant.sku || null,
  inventory_quantity: variant.inventoryQuantity || 0,
  weight: variant.weight || 0,
  weight_unit: variant.weightUnit || 'kg',
  image_url: variant.image?.src || null,
  created_at: variant.createdAt,
  updated_at: variant.updatedAt,
  is_active: true,
}));
```

**New Code**:
```typescript
const variantsToUpsert = variants.map(variant => {
  const priceDecimal = parseFloat(variant.price);
  return {
    store_id: storeId,
    product_id: productDbId,
    shopify_id: variant.id,
    title: variant.title,
    price: variant.price.toString(),
    starting_price: priceDecimal,  // NEW: Set starting price
    current_price: priceDecimal,   // NEW: Set current price
    compare_at_price: variant.compareAtPrice?.toString() || null,
    sku: variant.sku || null,
    inventory_quantity: variant.inventoryQuantity || 0,
    weight: variant.weight || 0,
    weight_unit: variant.weightUnit || 'kg',
    image_url: variant.image?.src || null,
    created_at: variant.createdAt,
    updated_at: variant.updatedAt,
    is_active: true,
  };
});
```

**Action**: Replace lines 206-221 with the new code block above.

## Phase 2: Pricing Config Migration (Product → Variant)

### Step 2.1: Create Data Migration Script

**File**: `supabase/migrations/022_migrate_pricing_configs.sql`

```sql
-- Migrate existing product-level pricing_configs to variant-level
-- This ensures existing configurations are preserved during the migration

BEGIN;

-- Create temporary mapping of products to their default variant
CREATE TEMP TABLE product_default_variants AS
SELECT 
  p.id as product_id,
  p.store_id,
  pv.id as variant_id,
  ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY pv.created_at ASC) as variant_rank
FROM products p
JOIN product_variants pv ON p.id = pv.product_id
WHERE p.id IN (SELECT DISTINCT product_id FROM pricing_config);

-- Migrate pricing_config to first variant of each product
INSERT INTO pricing_config (
  variant_id,
  auto_pricing_enabled,
  increment_percentage,
  period_hours,
  revenue_drop_threshold,
  wait_hours_after_revert,
  max_increase_percentage,
  current_state,
  last_price_change_date,
  revert_wait_until_date,
  pre_smart_pricing_price,
  last_smart_pricing_price,
  next_price_change_date,
  created_at,
  updated_at
)
SELECT 
  pdv.variant_id,
  pc.auto_pricing_enabled,
  pc.increment_percentage,
  pc.period_hours,
  pc.revenue_drop_threshold,
  pc.wait_hours_after_revert,
  pc.max_increase_percentage,
  pc.current_state,
  pc.last_price_change_date,
  pc.revert_wait_until_date,
  pc.pre_smart_pricing_price,
  pc.last_smart_pricing_price,
  pc.next_price_change_date,
  pc.created_at,
  pc.updated_at
FROM pricing_config pc
JOIN product_default_variants pdv ON pc.product_id = pdv.product_id
WHERE pdv.variant_rank = 1  -- Only migrate to first variant
  AND pc.variant_id IS NULL;  -- Only migrate configs not already migrated

-- Copy product current_price to variant current_price if missing
UPDATE product_variants pv
SET current_price = p.current_price
FROM products p
WHERE pv.product_id = p.id
  AND pv.current_price IS NULL;

-- Drop old product_id based configs (after verifying migration worked)
-- WARNING: Comment this out initially, uncomment after manual verification
-- DELETE FROM pricing_config WHERE variant_id IS NULL;

COMMIT;
```

**Action**: 
1. Run this migration
2. Manually verify that pricing_configs were migrated correctly
3. Check a few products to ensure variant_id is populated
4. Uncomment the DELETE statement if verification passes

### Step 2.2: Update RLS Policies for Variant-Level Access

**File**: `supabase/migrations/023_update_rls_for_variants.sql`

```sql
-- Update RLS policies to allow variant-level pricing config access

BEGIN;

-- Drop old product-based policy on pricing_config
DROP POLICY IF EXISTS pricing_config_select_own_store ON pricing_config;
DROP POLICY IF EXISTS pricing_config_update_own_store ON pricing_config;
DROP POLICY IF EXISTS pricing_config_insert_own_store ON pricing_config;
DROP POLICY IF EXISTS pricing_config_delete_own_store ON pricing_config;

-- Create new variant-based policies
CREATE POLICY pricing_config_select_own_store ON pricing_config
  FOR SELECT
  USING (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE p.store_id IN (
        SELECT id FROM stores WHERE user_id::text = auth.uid()::text
      )
    )
  );

CREATE POLICY pricing_config_update_own_store ON pricing_config
  FOR UPDATE
  USING (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE p.store_id IN (
        SELECT id FROM stores WHERE user_id::text = auth.uid()::text
      )
    )
  );

CREATE POLICY pricing_config_insert_own_store ON pricing_config
  FOR INSERT
  WITH CHECK (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE p.store_id IN (
        SELECT id FROM stores WHERE user_id::text = auth.uid()::text
      )
    )
  );

CREATE POLICY pricing_config_delete_own_store ON pricing_config
  FOR DELETE
  USING (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE p.store_id IN (
        SELECT id FROM stores WHERE user_id::text = auth.uid()::text
      )
    )
  );

COMMIT;
```

**Action**: Run this migration

## Phase 3: Update Pricing Engine Code

### Step 3.1: Update Pricing Algorithm Interface

**File**: `src/features/pricing-engine/services/pricingAlgorithm.ts`

**Changes Required**:

1. **Line 15-22**: Update `ProductRow` interface to reference variants

**Current**:
```typescript
interface ProductRow {
  id: string;
  title: string;
  shopify_id: string;
  starting_price: number;
  current_price: number;
  pricing_config: PricingConfig | PricingConfig[];
}
```

**New** (change this to `VariantRow`):
```typescript
interface VariantRow {
  id: string;
  title: string;
  shopify_id: string;
  starting_price: number;
  current_price: number;
  product_id: string;  // Track parent product
  store_id: string;    // Track store for Shopify updates
  pricing_config: PricingConfig | PricingConfig[];
}

interface ProductRow {
  id: string;
  title: string;
  shopify_id: string;
  starting_price: number;
  current_price: number;
  store_id: string;
  pricing_config: PricingConfig | PricingConfig[];
}
```

2. **Update query logic** to fetch variants instead of products

The main algorithm function needs to query `product_variants` with `pricing_config` join instead of `products`.

3. **Replace all usages** of `ProductRow` with `VariantRow` in pricing algorithm logic

### Step 3.2: Update Pricing Config API Routes

**File**: `src/app/api/pricing/config/[productId]/route.ts`

This file currently handles product-level toggles. It needs to be updated to handle variant IDs.

**Critical Change**: The endpoint should accept either `productId` OR `variantId` and route accordingly.

**New approach**: Create separate routes or use query parameters:

**Option A**: Create new route `src/app/api/pricing/config/variant/[variantId]/route.ts`
**Option B**: Modify existing route to detect if ID is variant or product

**Recommended**: Option A (cleaner separation)

### Step 3.3: Update Shopify Price Update Function

**File**: `src/features/pricing-engine/services/shopifyPriceUpdate.ts`

**Current function**:
```typescript
export async function updateShopifyPriceForStore(
  shopifyId: string,
  newPrice: number,
  storeId: string
): Promise<void>
```

**Note**: This function takes `shopifyId` which could be either a product ID or variant ID. Since Shopify API updates variant prices via the variant ID, ensure the `shopifyId` being passed is the VARIANT ID, not the product ID.

**Verification**: Check all call sites to ensure variant shopify_id is being passed.

### Step 3.4: Update Toggle Handlers for Immediate 5% Increase

**Files to modify**:
- `src/app/api/pricing/config/[productId]/route.ts` (when enabling smart pricing)
- `src/app/api/pricing/resume/route.ts` (when resuming)
- `src/app/api/pricing/global-resume/route.ts` (when resuming globally)

**Current behavior**: Enable smart pricing sets config but doesn't change price immediately

**New behavior**: When enabling smart pricing, immediately increase variant price by 5%

**Implementation for individual enable** (in `handleSmartPricingToggle`):

```typescript
if (enabled) {
  // TURNING ON smart pricing
  const config = Array.isArray(product.pricing_config) 
    ? product.pricing_config[0] 
    : product.pricing_config;
  
  // Calculate immediate 5% increase
  const immediateIncreasePrice = product.current_price * 1.05;
  
  // If first time, set pre_smart_pricing_price
  if (!config.pre_smart_pricing_price) {
    await supabaseAdmin
      .from('pricing_config')
      .update({ pre_smart_pricing_price: product.current_price })
      .eq('variant_id', actualProductId);
  }
  
  // Set last_smart_pricing_price to current
  await supabaseAdmin
    .from('pricing_config')
    .update({ last_smart_pricing_price: product.current_price })
    .eq('variant_id', actualProductId);
  
  // Update variant price with immediate increase
  await supabaseAdmin
    .from('product_variants')
    .update({ current_price: immediateIncreasePrice })
    .eq('id', actualProductId);
  
  // Update Shopify
  await updateShopifyPriceForStore(product.shopify_id as string, immediateIncreasePrice, product.store_id as string);
  
  return NextResponse.json({
    success: true,
    immediatePrice: immediateIncreasePrice,
    snapshot: {
      productId: product.shopify_id as string,
      price: immediateIncreasePrice,
      auto_pricing_enabled: true,
    },
  });
}
```

### Step 3.5: Update last_smart_pricing_price on Every Cycle

**File**: `src/features/pricing-engine/services/pricingAlgorithm.ts`

**Location**: Inside the price increase logic (after calculating new price)

**Current behavior**: `last_smart_pricing_price` only updated on toggle OFF

**New behavior**: Update `last_smart_pricing_price` every time price increases

**Implementation**: Find the section that increases price and add:

```typescript
// After calculating newPrice
await supabaseAdmin
  .from('pricing_config')
  .update({ 
    last_smart_pricing_price: variant.current_price,  // Save OLD price before increase
    next_price_change_date: nextChangeDate 
  })
  .eq('variant_id', variant.id);

// Then update variant price
await supabaseAdmin
  .from('product_variants')
  .update({ current_price: newPrice })
  .eq('id', variant.id);
```

## Phase 4: Frontend Updates

### Step 4.1: Update Product Display to Show Variants

**File**: `src/features/product-management/components/ProductRow.tsx` (or similar)

**Required changes**:
1. Display multiple variants per product
2. Each variant shows its own price
3. Each variant has its own smart pricing toggle
4. Each variant has its own analytics

### Step 4.2: Update Toggle Components

**Files**: Any component with smart pricing toggles

**Required changes**:
1. Pass variant_id instead of product_id to API
2. Update UI to reflect variant-level pricing

### Step 4.3: Update Type Definitions

**File**: `src/shared/types/index.ts` or feature-specific types

Add/update interfaces to reflect variant-level pricing:

```typescript
export interface ProductVariant {
  id: string;
  product_id: string;
  shopify_id: string;
  title: string;
  starting_price: number;
  current_price: number;
  store_id: string;
  pricing_config?: PricingConfig;
}

export interface PricingConfig {
  variant_id: string;
  product_id?: string;  // Optional for backward compatibility
  auto_pricing_enabled: boolean;
  // ... rest of config
}
```

## Phase 5: Testing & Verification

### Step 5.1: Database Verification

Run these queries after migration:

```sql
-- 1. Verify all variants have pricing config
SELECT COUNT(*) as total_variants,
       COUNT(pc.id) as configs,
       COUNT(*) - COUNT(pc.id) as missing_configs
FROM product_variants pv
LEFT JOIN pricing_config pc ON pv.id = pc.variant_id;

-- 2. Verify pricing configs point to valid variants
SELECT COUNT(*) as orphaned_configs
FROM pricing_config pc
LEFT JOIN product_variants pv ON pc.variant_id = pv.id
WHERE pc.variant_id IS NOT NULL AND pv.id IS NULL;

-- 3. Verify variant prices are set
SELECT COUNT(*) as variants_without_prices
FROM product_variants
WHERE starting_price IS NULL OR current_price IS NULL;

-- 4. Check sample data
SELECT 
  p.title as product_title,
  pv.title as variant_title,
  pv.starting_price,
  pv.current_price,
  pc.auto_pricing_enabled
FROM products p
JOIN product_variants pv ON p.id = pv.product_id
LEFT JOIN pricing_config pc ON pv.id = pc.variant_id
LIMIT 10;
```

### Step 5.2: Functional Testing

1. **Sync Products**: Run product sync and verify variant prices are populated
2. **Toggle ON**: Enable smart pricing for a variant, verify immediate 5% increase
3. **Toggle OFF**: Disable smart pricing, verify revert to starting_price
4. **Cycle Increase**: Wait for algorithm cycle, verify 5% increase and last_smart_pricing_price update
5. **Resume**: Turn smart pricing back on, verify resume behavior
6. **Multi-Variant**: Test product with multiple variants having different settings

### Step 5.3: Error Handling

Test edge cases:
- Variant with no config
- Config with no variant
- Variant with null prices
- Concurrent updates
- Shopify API failures

## Phase 6: Rollout Strategy

### Step 6.1: Backward Compatibility

Maintain ability to read old product-level configs during transition period:

```typescript
// Helper function to get active pricing config (variant or product fallback)
async function getPricingConfig(productId: string, variantId: string) {
  // Try variant config first
  const variantConfig = await getVariantConfig(variantId);
  if (variantConfig) return variantConfig;
  
  // Fallback to product config (legacy)
  return await getProductConfig(productId);
}
```

### Step 6.2: Gradual Migration

1. Run migrations on test database first
2. Verify all data migrated correctly
3. Deploy code changes
4. Monitor for errors
5. Clean up legacy configs after successful rollout

### Step 6.3: Communication

Update documentation:
- Update API docs to reflect variant-level endpoints
- Update user guide to explain variant-level pricing
- Add migration notes for developers

## Critical Dependencies & Order

1. **Database migrations MUST run in order**: 020 → 021 → 022 → 023
2. **Code deployment can happen after migrations 020, 021 complete**
3. **Frontend updates should be deployed with backend API changes**
4. **Do NOT delete product_id from pricing_config until verified**

## Rollback Plan

If issues arise:

1. **Stop new smart pricing changes** (set global toggle to OFF)
2. **Database rollback**: Re-run migration 022 to restore product-level configs
3. **Code rollback**: Revert to previous deployment
4. **Investigae**: Check migration logs and application logs

## Success Criteria

- [ ] All variants have starting_price and current_price populated
- [ ] All pricing configs migrated to variant-level
- [ ] Toggle ON immediately increases price by 5%
- [ ] Toggle OFF reverts to starting_price
- [ ] Cycle increases update last_smart_pricing_price
- [ ] Resume from base/last works correctly
- [ ] Frontend displays variant-level pricing
- [ ] No orphaned configs
- [ ] RLS policies working correctly
- [ ] All tests passing

## Files Modified Summary

**Database Migrations**:
- `supabase/migrations/020_add_variant_store_id.sql` (NEW)
- `supabase/migrations/021_variant_level_pricing.sql` (NEW)
- `supabase/migrations/022_migrate_pricing_configs.sql` (NEW)
- `supabase/migrations/023_update_rls_for_variants.sql` (NEW)

**Backend Code**:
- `src/features/shopify-integration/services/syncProducts.ts`
- `src/features/pricing-engine/services/pricingAlgorithm.ts`
- `src/app/api/pricing/config/[productId]/route.ts`
- `src/app/api/pricing/config/variant/[variantId]/route.ts` (NEW)
- `src/app/api/pricing/resume/route.ts`
- `src/app/api/pricing/global-resume/route.ts`
- `src/app/api/pricing/global-disable/route.ts`
- `src/features/pricing-engine/services/shopifyPriceUpdate.ts`

**Frontend Code**:
- Component files displaying products
- Toggle UI components
- Type definitions

**Documentation**:
- API documentation
- User guides
- Migration notes

## Estimated Time

- Phase 1 (Schema): 1 hour
- Phase 2 (Migration): 2 hours
- Phase 3 (Code): 4 hours
- Phase 4 (Frontend): 3 hours
- Phase 5 (Testing): 3 hours
- Phase 6 (Rollout): 1 hour

**Total**: ~14 hours

## Known Risks

1. **Data loss**: Migration scripts must be tested thoroughly
2. **Downtime**: Migrations may lock tables
3. **Performance**: Variant-level queries may be slower initially
4. **Rollback complexity**: Clean rollback may not be possible
5. **User confusion**: UI changes may confuse existing users

## Next Steps After Completion

1. Monitor production for any pricing algorithm errors
2. Gather user feedback on variant-level pricing
3. Consider adding bulk variant operations
4. Optimize queries based on production usage patterns
5. Remove product_id fallback after confidence established

