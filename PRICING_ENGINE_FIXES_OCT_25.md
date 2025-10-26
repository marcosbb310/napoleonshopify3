# Pricing Engine Production-Ready Implementation Plan

## Critical Issues to Fix

1. ❌ **Products never synced to database** - Algorithm queries `products` table but it's empty
2. ❌ **No pricing_config rows created** - When smart pricing enabled, no config row exists
3. ❌ **Sales sync not scheduled** - Hourly sales task exists but never runs automatically
4. ❌ **First price increase logic missing** - Should increase immediately without revenue data
5. ❌ **Store context missing** - Multi-store support incomplete
6. ❌ **Hardcoded credentials** - Uses env vars instead of store-specific tokens

## Phase 1: Product Sync Infrastructure

### File 1: `src/features/shopify-integration/services/syncProducts.ts` (NEW)

Create complete product sync service:

```typescript
import { createAdminClient } from '@/shared/lib/supabase';
import { ShopifyClient } from './shopifyClient';

interface SyncResult {
  success: boolean;
  productsCreated: number;
  productsUpdated: number;
  errors: string[];
}

export async function syncProductsFromShopify(
  storeId: string,
  shopDomain: string,
  accessToken: string
): Promise<SyncResult> {
  const errors: string[] = [];
  let productsCreated = 0;
  let productsUpdated = 0;

  try {
    const supabase = createAdminClient();
    
    // Create Shopify client with store-specific credentials
    const client = new ShopifyClient({
      storeUrl: shopDomain,
      accessToken: accessToken,
    });

    // Fetch all products from Shopify
    const response = await client.getProducts();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        productsCreated: 0,
        productsUpdated: 0,
        errors: [response.error?.message || 'Failed to fetch products'],
      };
    }

    const products = response.data;
    console.log(`📦 Syncing ${products.length} products for store ${shopDomain}`);

    // Process each product
    for (const product of products) {
      try {
        // Get first variant price (all products have at least one variant)
        const firstVariant = product.variants[0];
        if (!firstVariant) {
          errors.push(`Product ${product.title} has no variants, skipping`);
          continue;
        }

        const price = parseFloat(firstVariant.price);
        if (isNaN(price) || price < 0) {
          errors.push(`Product ${product.title} has invalid price: ${firstVariant.price}`);
          continue;
        }

        // Check if product already exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('store_id', storeId)
          .eq('shopify_id', product.id)
          .single();

        // Upsert product
        const { error: upsertError } = await supabase
          .from('products')
          .upsert({
            store_id: storeId,
            shopify_id: product.id,
            title: product.title,
            vendor: product.vendor || null,
            product_type: product.productType || null,
            starting_price: price,
            current_price: price,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'store_id,shopify_id',
          });

        if (upsertError) {
          errors.push(`Failed to sync ${product.title}: ${upsertError.message}`);
          continue;
        }

        if (existing) {
          productsUpdated++;
        } else {
          productsCreated++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Error processing ${product.title}: ${message}`);
      }
    }

    console.log(`✅ Sync complete: ${productsCreated} created, ${productsUpdated} updated`);

    return {
      success: errors.length === 0,
      productsCreated,
      productsUpdated,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      productsCreated: 0,
      productsUpdated: 0,
      errors: [message],
    };
  }
}
```

### File 2: `src/app/api/shopify/sync-products/route.ts` (NEW)

Create API endpoint for manual product sync:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { getDecryptedTokens } from '@/features/shopify-oauth/services/tokenService';
import { syncProductsFromShopify } from '@/features/shopify-integration/services/syncProducts';

export async function POST(request: NextRequest) {
  try {
    // Require authenticated store
    const { user, store, error: authError } = await requireStore(request);
    if (authError) return authError;

    // Get decrypted access token
    const tokens = await getDecryptedTokens(store.id);
    if (!tokens) {
      return NextResponse.json(
        { success: false, error: 'Store credentials not found' },
        { status: 404 }
      );
    }

    // Sync products
    const result = await syncProductsFromShopify(
      store.id,
      store.shop_domain,
      tokens.accessToken
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
```

**Note:** OAuth callback at `src/app/api/auth/shopify/v2/callback/route.ts` line 218-220 already calls `triggerProductSyncAsync()` which will automatically use this service once created.

## Phase 2: Auto-Create Pricing Config

### File 3: `src/app/api/pricing/config/[productId]/route.ts` (MODIFY)

In the `handleSmartPricingToggle()` function around **line 156**, replace the "TURNING ON" section:

```typescript
if (enabled) {
  // TURNING ON smart pricing
  
  // Create pricing_config if it doesn't exist
  if (!config) {
    const { error: createError } = await supabaseAdmin
      .from('pricing_config')
      .insert({
        product_id: product.id,
        auto_pricing_enabled: false, // Will be set to true after modal confirmation
        increment_percentage: 5.0,
        period_hours: 24,
        revenue_drop_threshold: 1.0,
        wait_hours_after_revert: 24,
        max_increase_percentage: 100.0,
        current_state: 'increasing',
        is_first_increase: true, // NEW: Flag for immediate first increase
        next_price_change_date: new Date().toISOString(), // NEW: Immediate first run
        pre_smart_pricing_price: product.current_price,
      });
    
    if (createError) {
      return NextResponse.json(
        { success: false, error: `Failed to create config: ${createError.message}` },
        { status: 500 }
      );
    }
    
    // Fetch the newly created config
    const { data: newConfig } = await supabaseAdmin
      .from('pricing_config')
      .select('*')
      .eq('product_id', product.id)
      .single();
    
    config = newConfig;
  }
  
  // If first time, set pre_smart_pricing_price
  if (!config.pre_smart_pricing_price) {
    await supabaseAdmin
      .from('pricing_config')
      .update({ pre_smart_pricing_price: product.current_price })
      .eq('product_id', product.id);
  }

  return NextResponse.json({
    success: true,
    showModal: true,
    preSmart: config.pre_smart_pricing_price || product.current_price,
    lastSmart: config.last_smart_pricing_price || product.current_price,
    snapshot: {
      productId,
      price: product.current_price,
      auto_pricing_enabled: false,
      state: config.current_state,
    },
  });
}
```

### File 4: `src/app/api/pricing/resume/route.ts` (MODIFY)

After **line 77** where `auto_pricing_enabled: true` is set, replace with:

```typescript
await supabaseAdmin
  .from('pricing_config')
  .update({
    auto_pricing_enabled: true,
    current_state: 'increasing',
    revert_wait_until_date: null,
    is_first_increase: true, // NEW: Treat resume as first increase
    next_price_change_date: new Date().toISOString(), // NEW: Immediate run
  })
  .eq('product_id', product.id);
```

### File 5: `src/app/api/pricing/global-resume/route.ts` (MODIFY)

Around **line 72-76**, replace the update block:

```typescript
await supabaseAdmin
  .from('pricing_config')
  .update({
    auto_pricing_enabled: true,
    current_state: 'increasing',
    revert_wait_until_date: null,
    is_first_increase: true, // NEW: Treat global resume as first increase
    next_price_change_date: new Date().toISOString(), // NEW: Immediate run
  })
  .eq('product_id', product.id);
```

## Phase 3: First Price Increase Logic

### File 6: `supabase/migrations/019_add_first_increase_flag.sql` (NEW)

```sql
-- Add is_first_increase flag to pricing_config
ALTER TABLE pricing_config 
  ADD COLUMN IF NOT EXISTS is_first_increase BOOLEAN DEFAULT TRUE;

-- Backfill existing products to false (they've already had increases)
UPDATE pricing_config 
SET is_first_increase = FALSE 
WHERE last_price_change_date IS NOT NULL;

-- Add comment
COMMENT ON COLUMN pricing_config.is_first_increase IS 
  'True if product has never had a price increase. First increase happens immediately without revenue check.';
```

### File 7: `src/features/pricing-engine/services/pricingAlgorithm.ts` (MODIFY)

**At line 24**, add to PricingConfig interface:

```typescript
interface PricingConfig {
  current_state: string;
  auto_pricing_enabled?: boolean;
  increment_percentage?: number;
  period_hours?: number;
  revenue_drop_threshold?: number;
  wait_hours_after_revert?: number;
  max_increase_percentage?: number;
  last_price_change_date?: string;
  revert_wait_until_date?: string;
  next_price_change_date?: string;
  max_price_cap?: number;
  current_price?: number;
  base_price?: number;
  price_change_frequency_hours?: number;
  is_first_increase?: boolean; // NEW
}
```

**At line 150-164**, replace the revenue decision logic in `processProduct()`:

```typescript
// Step 4: Get revenue data
const periodHours = config.period_hours ?? 24;
const revenue = await getRevenue(product.id, periodHours);

// Step 5: Decide what to do
const isFirstIncrease = config.is_first_increase !== false; // Default to true if undefined

if (isFirstIncrease) {
  // FIRST INCREASE: No revenue check needed, increase immediately
  console.log(`🚀 First increase for ${product.title} - no revenue check needed`);
  await increasePrice(product, config, stats, null, shopDomain, accessToken, storeId, true);
} else if (!revenue.hasSufficientData) {
  // Not enough data to make decision - increase anyway (optimistic)
  console.log(`📊 Insufficient revenue data for ${product.title} - increasing optimistically`);
  await increasePrice(product, config, stats, revenue, shopDomain, accessToken, storeId, false);
} else if (revenue.changePercent < -(config.revenue_drop_threshold || 1.0)) {
  // Revenue dropped significantly - revert
  console.log(`📉 Revenue dropped ${revenue.changePercent.toFixed(1)}% for ${product.title} - reverting`);
  await revertPrice(product, config, stats, revenue, shopDomain, accessToken, storeId);
} else {
  // Revenue stable/up - increase
  console.log(`📈 Revenue ${revenue.changePercent >= 0 ? 'up' : 'stable'} for ${product.title} - increasing`);
  await increasePrice(product, config, stats, revenue, shopDomain, accessToken, storeId, false);
}
```

**At line 200**, modify `increasePrice()` signature and implementation:

```typescript
async function increasePrice(
  product: ProductRow, 
  config: PricingConfig, 
  stats: AlgorithmStats, 
  revenue: RevenueData | null, 
  shopDomain: string, 
  accessToken: string, 
  storeId: string,
  isFirstIncrease: boolean // NEW parameter
) {
  const supabaseAdmin = createAdminClient();
  const newPrice = product.current_price * (1 + (config.increment_percentage || 5.0) / 100);
  const percentIncrease = ((newPrice - product.starting_price) / product.starting_price) * 100;

  // Check max cap
  if (percentIncrease > (config.max_increase_percentage || 100.0)) {
    const maxPrice = product.starting_price * (1 + (config.max_increase_percentage || 100.0) / 100);
    await updatePrice(product, config, maxPrice, 'increase', 'Hit max cap', revenue, shopDomain, accessToken, storeId);
    await supabaseAdmin
      .from('pricing_config')
      .update({ 
        current_state: 'at_max_cap',
        is_first_increase: false, // NEW: Clear flag
      })
      .eq('product_id', product.id);
    stats.increased++;
    return;
  }

  const reason = isFirstIncrease 
    ? 'First price increase (no revenue check)'
    : revenue 
      ? `Revenue ${(revenue as any).changePercent >= 0 ? 'up' : 'stable'}` 
      : 'Insufficient data (optimistic increase)';

  await updatePrice(product, config, newPrice, 'increase', reason, revenue, shopDomain, accessToken, storeId);
  
  // Clear first increase flag
  if (isFirstIncrease) {
    await supabaseAdmin
      .from('pricing_config')
      .update({ is_first_increase: false })
      .eq('product_id', product.id);
  }
  
  stats.increased++;
}
```

**At line 170**, improve `getRevenue()` to require minimum data:

```typescript
async function getRevenue(productId: string, periodHours: number) {
  const supabaseAdmin = createAdminClient();
  const now = new Date();
  const currentStart = new Date(now.getTime() - periodHours * 60 * 60 * 1000);
  const previousStart = new Date(currentStart.getTime() - periodHours * 60 * 60 * 1000);

  const { data: currentData } = await supabaseAdmin
    .from('sales_data')
    .select('revenue, units_sold')
    .eq('product_id', productId)
    .gte('date', currentStart.toISOString().split('T')[0]);

  const { data: previousData } = await supabaseAdmin
    .from('sales_data')
    .select('revenue, units_sold')
    .eq('product_id', productId)
    .gte('date', previousStart.toISOString().split('T')[0])
    .lt('date', currentStart.toISOString().split('T')[0]);

  const currentRevenue = currentData?.reduce((sum, r) => sum + (r.revenue || 0), 0) || 0;
  const previousRevenue = previousData?.reduce((sum, r) => sum + (r.revenue || 0), 0) || 0;
  
  // Require at least 2 sales in each period for valid comparison
  const currentSales = currentData?.reduce((sum, r) => sum + (r.units_sold || 0), 0) || 0;
  const previousSales = previousData?.reduce((sum, r) => sum + (r.units_sold || 0), 0) || 0;
  
  const hasSufficientData = currentRevenue > 0 && previousRevenue > 0 && 
                           currentSales >= 2 && previousSales >= 2;
  
  const changePercent = previousRevenue > 0 
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
    : 0;

  console.log(`📊 Revenue data for product ${productId}:`, {
    currentRevenue,
    previousRevenue,
    currentSales,
    previousSales,
    changePercent: changePercent.toFixed(1) + '%',
    hasSufficientData,
  });

  return { currentRevenue, previousRevenue, changePercent, hasSufficientData };
}
```

## Phase 4: Schedule Sales Sync

### File 8: `src/trigger/hourly-sales-sync.ts` (MODIFY)

Replace entire file with scheduled version - see plan for complete code.

## Phases 5-9: Additional Implementation

See complete plan document for:
- Phase 5: Initial Data Sync Endpoint
- Phase 6: Settings Page Sync UI
- Phase 7: Algorithm Health Monitoring
- Phase 8: Testing & Validation
- Phase 9: Deployment & Verification

## Success Criteria Checklist

- ✅ Products automatically sync after OAuth
- ✅ `pricing_config` row auto-created when smart pricing enabled
- ✅ First price increase happens immediately (no revenue check)
- ✅ `is_first_increase` flag set to false after first increase
- ✅ Subsequent increases check revenue data
- ✅ Revenue drops >1% trigger rollback
- ✅ Sales data syncs hourly automatically
- ✅ Algorithm runs daily at 2 AM automatically
- ✅ Multi-store support works (each store has own tokens)
- ✅ Settings page has sync button
- ✅ Dashboard shows algorithm health
- ✅ All Shopify API calls use store-specific credentials
- ✅ Comprehensive logging for debugging

## Files Summary

**New Files (6):**
1. `src/features/shopify-integration/services/syncProducts.ts`
2. `src/app/api/shopify/sync-products/route.ts`
3. `src/app/api/shopify/initial-sync/route.ts`
4. `src/app/api/pricing/test-algorithm/route.ts`
5. `src/app/api/analytics/algorithm-health/route.ts`
6. `supabase/migrations/019_add_first_increase_flag.sql`

**Modified Files (7):**
7. `src/app/api/pricing/config/[productId]/route.ts`
8. `src/app/api/pricing/resume/route.ts`
9. `src/app/api/pricing/global-resume/route.ts`
10. `src/features/pricing-engine/services/pricingAlgorithm.ts`
11. `src/trigger/hourly-sales-sync.ts`
12. `src/app/(app)/settings/page.tsx`
13. `src/app/(app)/dashboard/page.tsx`

## Deployment Strategy

**Recommended: Trigger.dev Cloud**
- Zero maintenance
- Automatic scaling  
- Built-in monitoring
- Free for up to 1000 runs/month
- Perfect for Vercel deployment

**Cost:** FREE for most users (up to ~10 stores)

