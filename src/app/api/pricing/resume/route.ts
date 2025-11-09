// Resume smart pricing with user's choice - operates on all variants
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';
import {
  resumeVariantSmartPricing,
} from '@/features/pricing-engine/services/smartPricingService';
import {
  getVariantsByProductId,
  getVariantConfig,
} from '@/shared/lib/variantHelpers';

export async function POST(request: NextRequest) {
  try {
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

    // Get all variants for this product
    const variants = await getVariantsByProductId(productId);

    if (variants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No variants found for this product' },
        { status: 404 }
      );
    }

    // Process all variants
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

    return NextResponse.json({
      success: true,
      variantsResumed: results.length,
      resumeOption,
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

