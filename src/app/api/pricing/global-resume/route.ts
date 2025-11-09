// Resume smart pricing globally with user's choice - operates on all variants
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';
import {
  resolveResumePrice,
  resumeVariantSmartPricing,
} from '@/features/pricing-engine/services/smartPricingService';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const body = await request.json();
    const { resumeOption } = body;

    if (!resumeOption || !['base', 'last'].includes(resumeOption)) {
      return NextResponse.json(
        { success: false, error: 'resumeOption must be "base" or "last"' },
        { status: 400 }
      );
    }

    // Get all variants with smart pricing disabled
    const { data: variants, error } = await supabaseAdmin
      .from('product_variants')
      .select('*, pricing_config!inner(*)')
      .eq('pricing_config.auto_pricing_enabled', false);

    if (error) throw error;

    if (!variants || variants.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'No variants with smart pricing disabled',
        variantSnapshots: [],
      });
    }

    // Build snapshots array
    const snapshots = variants.map((variant) => {
      const config = Array.isArray(variant.pricing_config)
        ? variant.pricing_config[0]
        : variant.pricing_config;

      const newPrice = resolveResumePrice(
        {
          id: variant.id,
          product_id: variant.product_id,
          store_id: variant.store_id,
          shopify_id: variant.shopify_id,
          title: variant.title,
          current_price: variant.current_price,
          starting_price: variant.starting_price,
        },
        config,
        resumeOption
      );

      return {
        variantId: variant.id,
        shopifyId: variant.shopify_id,
        variantTitle: variant.title,
        price: variant.current_price,
        newPrice,
        auto_pricing_enabled: false,
        current_state: config.current_state,
      };
    });

    // Process all variants in PARALLEL for much faster performance
    await Promise.all(
      variants.map(async (variant) => {
        const config = Array.isArray(variant.pricing_config)
          ? variant.pricing_config[0]
          : variant.pricing_config;

        await resumeVariantSmartPricing(
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
      })
    );

    // CRITICAL: Update global setting in Supabase
    await supabaseAdmin
      .from('global_settings')
      .update({ value: true })
      .eq('key', 'smart_pricing_global_enabled');

    return NextResponse.json({
      success: true,
      count: variants.length,
      resumeOption,
      variantSnapshots: snapshots,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

