// Resume smart pricing with user's choice - operates on all variants
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';
import {
  resumeVariantSmartPricing,
  resolveResumePrice,
} from '@/features/pricing-engine/services/smartPricingService';
import {
  getVariantsByProductId,
  getVariantConfig,
} from '@/shared/lib/variantHelpers';

export async function POST(request: NextRequest) {
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error: authError } = await requireStore(request);
    if (authError) return authError;

    const supabaseAdmin = createAdminClient();
    const body = await request.json();
    const { productId, resumeOption } = body;

    if (!productId || !resumeOption) {
      return NextResponse.json(
        { success: false, error: 'productId and resumeOption required' },
        { status: 400 }
      );
    }

    if (!['base', 'last'].includes(resumeOption)) {
      return NextResponse.json(
        { success: false, error: 'resumeOption must be "base" or "last"' },
        { status: 400 }
      );
    }

    // Get all variants for this product (with store verification)
    const variants = await getVariantsByProductId(productId, store.id);

    if (variants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No variants found for this product' },
        { status: 404 }
      );
    }

    // Get product info for snapshots
    // Use the internal product_id from the first variant (already fetched and verified)
    const firstVariant = variants[0];
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, shopify_id')
      .eq('id', firstVariant.product_id)
      .single();

    if (productError) {
      console.error('Error fetching product:', productError);
      throw new Error(`Failed to fetch product: ${productError.message}`);
    }

    // Create snapshots BEFORE resuming (capture current state)
    const snapshots = await Promise.all(
      variants.map(async (variant) => {
        const config = await getVariantConfig(variant.id);
        
        // Calculate what price will be after resume
        const newPrice = resolveResumePrice(
          {
            id: variant.id,
            product_id: variant.product_id,
            store_id: variant.store_id,
            shopify_id: variant.shopify_id,
            shopify_product_id: variant.shopify_product_id,
            title: variant.title,
            current_price: variant.current_price,
            starting_price: variant.starting_price,
          },
          config,
          resumeOption
        );

        // Create ProductSnapshot (same structure as global button)
        return {
          productId: variant.product_id,
          shopifyId: variant.shopify_product_id || product.shopify_id, // Use product Shopify ID for Map key
          price: variant.current_price, // Old price (before resume)
          newPrice: newPrice, // New price (after resume)
          auto_pricing_enabled: false, // Was disabled before enable
          current_state: config?.current_state || null,
          next_price_change_date: config?.next_price_change_date || null,
          revert_wait_until_date: config?.revert_wait_until_date || null,
        };
      })
    );

    // Now resume smart pricing
    const results = await Promise.all(
      variants.map(async (variant) => {
        const config = await getVariantConfig(variant.id);

        const { resumedTo } = await resumeVariantSmartPricing(
          supabaseAdmin,
          {
            id: variant.id,
            product_id: variant.product_id,
            store_id: variant.store_id,
            shopify_id: variant.shopify_id,
            shopify_product_id: variant.shopify_product_id,
            title: variant.title,
            current_price: variant.current_price,
            starting_price: variant.starting_price,
          },
          config,
          resumeOption
        );

        return {
          variantId: variant.id,
          variantTitle: variant.title,
          price: resumedTo,
        };
      })
    );

    // Get first variant's price for backward compatibility
    const firstResult = results[0];
    const price = firstResult?.price || 0;

    console.log('✅ [API] Resume response structure', {
      success: true,
      variantsResumed: results.length,
      resumeOption,
      price,
      productSnapshotsCount: snapshots.length,
      snapshotShopifyIds: snapshots.map(s => s.shopifyId),
      responseWillInclude: ['success', 'variantsResumed', 'resumeOption', 'price', 'productSnapshots']
    });

    return NextResponse.json({
      success: true,
      variantsResumed: results.length,
      resumeOption,
      price, // For backward compatibility (first variant's price)
      productSnapshots: snapshots, // Array of snapshots (same as global)
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

