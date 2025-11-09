// API endpoints for pricing configuration management
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';
import { updateShopifyPriceForStore } from '@/features/pricing-engine/services/shopifyPriceUpdate';
import {
  disableVariantSmartPricing,
  resolveBaselinePrice,
} from '@/features/pricing-engine/services/smartPricingService';
import {
  getVariantsByProductId,
  getVariantConfig,
} from '@/shared/lib/variantHelpers';

// GET pricing config for a product - returns variant configs array
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error: authError } = await requireStore(request);
    if (authError) return authError;

    const { productId } = await params;

    // Get all variants for this product
    const variants = await getVariantsByProductId(productId, store?.id);

    if (variants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No variants found for this product' },
        { status: 404 }
      );
    }

    // Get configs for each variant
    const configs = await Promise.all(
      variants.map((v) => getVariantConfig(v.id))
    );

    return NextResponse.json({
      success: true,
      configs,
      variantCount: variants.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// PATCH pricing config for a product
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    console.log('🔷 PATCH /api/pricing/config/[productId] called with:', productId);
    
    // NEW AUTH: Require authenticated store
    const { user, store, error: authError } = await requireStore(request);
    if (authError) return authError;

    const body = await request.json();
    console.log('🔷 Request body:', body);
    const supabaseAdmin = createAdminClient();

    // Check if this is a smart pricing toggle
    if (body.auto_pricing_enabled !== undefined) {
      console.log('🔷 Calling handleSmartPricingToggle');
      return handleSmartPricingToggle(productId, body.auto_pricing_enabled, supabaseAdmin, store.id);
    }

    // Allowed fields to update (non-toggle changes)
    const allowedFields = [
      'increment_percentage',
      'period_hours',
      'revenue_drop_threshold',
      'wait_hours_after_revert',
      'max_increase_percentage',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Get variants for this product
    const variants = await getVariantsByProductId(productId, store.id);

    if (variants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No variants found for this product' },
        { status: 404 }
      );
    }

    // Update configs for all variants
    const updatedConfigs = await Promise.all(
      variants.map(async (variant) => {
        const { data, error } = await supabaseAdmin
          .from('pricing_config')
          .update(updates)
          .eq('variant_id', variant.id)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to update config for variant ${variant.id}: ${error.message}`);
        }

        return data;
      })
    );

    return NextResponse.json({
      success: true,
      message: 'Configuration updated',
      configs: updatedConfigs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Handle smart pricing toggle logic - operates on all variants of a product
async function handleSmartPricingToggle(
  productId: string,
  enabled: boolean,
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  storeId?: string
) {
  try {
    console.log('\n🔍 ===== SMART PRICING TOGGLE DEBUG =====');
    console.log('🔍 Received productId:', productId);
    console.log('🔍 Enabled:', enabled);
    console.log('🔍 Store ID provided:', storeId || 'NOT PROVIDED');
    console.log('========================================\n');

    // Get all variants for this product
    const variants = await getVariantsByProductId(productId, storeId);

    if (variants.length === 0) {
      console.error('❌ No variants found for product:', productId);
      return NextResponse.json(
        { success: false, error: 'No variants found for this product' },
        { status: 404 }
      );
    }

    console.log(`✅ Found ${variants.length} variants for product`);
    const missingShopifyProductId = variants.find(
      (variant) => !variant.shopify_product_id
    );

    if (missingShopifyProductId) {
      console.error(
        '❌ Missing shopify_product_id for variant',
        missingShopifyProductId.id,
        'Run full product sync.'
      );
      return NextResponse.json(
        {
          success: false,
          error:
            'Shopify product ID missing for one or more variants. Please run a full product sync and try again.',
        },
        { status: 409 }
      );
    }

    if (enabled) {
      // TURNING ON - Apply to all variants with immediate 5% increase
      const results = await Promise.all(
        variants.map(async (variant) => {
          const immediatePrice = variant.current_price * 1.05;

          // Get existing config if it exists
          let config = await getVariantConfig(variant.id);

          const shouldCaptureBaseline =
            !config || config.pre_smart_pricing_price == null;
          const baselinePrice = shouldCaptureBaseline
            ? variant.current_price
            : resolveBaselinePrice(variant, config);

          if (config?.id) {
            const updates: Record<string, unknown> = {
              auto_pricing_enabled: true,
              last_smart_pricing_price: variant.current_price,
              current_state: 'increasing',
              next_price_change_date: null,
              revert_wait_until_date: null,
            };

            if (shouldCaptureBaseline) {
              updates.pre_smart_pricing_price = baselinePrice;
            }

            const { data: updatedConfig, error: configUpdateError } =
              await supabaseAdmin
                .from('pricing_config')
                .update(updates)
                .eq('id', config.id)
                .select()
                .single();

            if (configUpdateError) {
              throw new Error(
                `Failed to update pricing config: ${configUpdateError.message}`
              );
            }

            config = updatedConfig;
          } else {
            const { data: insertedConfig, error: configInsertError } =
              await supabaseAdmin
                .from('pricing_config')
                .insert({
                  variant_id: variant.id,
                  auto_pricing_enabled: true,
                  pre_smart_pricing_price: baselinePrice,
                  last_smart_pricing_price: variant.current_price,
                  current_state: 'increasing',
                  next_price_change_date: null,
                  revert_wait_until_date: null,
                })
                .select()
                .single();

            if (configInsertError) {
              throw new Error(
                `Failed to create pricing config: ${configInsertError.message}`
              );
            }

            config = insertedConfig;
          }

          console.log(`🟢 TOGGLE ON: Variant ${variant.shopify_id}`, {
            beforePrice: variant.current_price,
            calculatedPrice: immediatePrice,
            baselinePrice,
          });

          const { error: variantUpdateError } = await supabaseAdmin
            .from('product_variants')
            .update({ current_price: immediatePrice })
            .eq('id', variant.id);

          if (variantUpdateError) {
            throw new Error(
              `Failed to update variant price: ${variantUpdateError.message}`
            );
          }

          await updateShopifyPriceForStore(
            variant.shopify_id,
            immediatePrice,
            variant.store_id
          );

          return {
            variantId: variant.id,
            variantTitle: variant.title,
            newPrice: immediatePrice,
          };
        })
      );

      return NextResponse.json({
        success: true,
        variantsUpdated: results.length,
        immediatePriceApplied: true,
        results,
      });
    } else {
      // TURNING OFF - Revert all variants to pre_smart_pricing_price
      const results = await Promise.all(
        variants.map(async (variant) => {
          // Get config
          const config = await getVariantConfig(variant.id);

          const result = await disableVariantSmartPricing(
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
            config
          );

          return {
            variantId: variant.id,
            variantTitle: variant.title,
            revertedPrice: result.revertedTo,
            preSmartPrice: config?.pre_smart_pricing_price,
          };
        })
      );

      // Calculate the first variant's reverted price for backward compatibility
      const firstResult = results[0];
      const revertedPrice = firstResult?.revertedPrice;

      return NextResponse.json({
        success: true,
        reverted: true,
        variantsReverted: results.length,
        revertedTo: revertedPrice, // For backward compatibility with frontend
        results,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error in handleSmartPricingToggle:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST to approve max cap increase
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const body = await request.json();
    const { newMaxPercentage } = body;

    // NEW AUTH: Require authenticated store
    const { user, store, error: authError } = await requireStore(request);
    if (authError) return authError;

    if (!newMaxPercentage || typeof newMaxPercentage !== 'number') {
      return NextResponse.json(
        { success: false, error: 'newMaxPercentage is required and must be a number' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Get variants for this product
    const variants = await getVariantsByProductId(productId, store.id);

    if (variants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No variants found for this product' },
        { status: 404 }
      );
    }

    // Update max cap for all variants
    const updatedConfigs = await Promise.all(
      variants.map(async (variant) => {
        const { data, error } = await supabaseAdmin
          .from('pricing_config')
          .update({
            max_increase_percentage: newMaxPercentage,
            current_state: 'increasing',
          })
          .eq('variant_id', variant.id)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to update config for variant ${variant.id}: ${error.message}`);
        }

        return data;
      })
    );

    return NextResponse.json({
      success: true,
      message: `Max cap increased to ${newMaxPercentage}% for ${variants.length} variant(s)`,
      configs: updatedConfigs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

