// Disable smart pricing globally for all variants
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';
import {
  disableVariantSmartPricing,
  resolveBaselinePrice,
} from '@/features/pricing-engine/services/smartPricingService';
import { updateShopifyPriceForStore } from '@/features/pricing-engine/services/shopifyPriceUpdate';
import { getDecryptedTokens } from '@/features/shopify-oauth/services/tokenService';

export async function POST() {
  try {
    const supabaseAdmin = createAdminClient();
    
    // Get ALL variants with enabled pricing configs (variant-level)
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from('product_variants')
      .select('*, pricing_config!inner(*)')
      .eq('pricing_config.auto_pricing_enabled', true);

    if (variantsError) {
      console.error('Error fetching variants:', variantsError);
      throw variantsError;
    }

    // ALSO get product-level configs (for backward compatibility with products that have no variants)
    // These are pricing_config entries that have product_id but no variant_id
    // Query pricing_config directly to avoid join filtering issues
    const { data: productLevelConfigs, error: productConfigsError } = await supabaseAdmin
      .from('pricing_config')
      .select('*, products(id, shopify_id, title, store_id, current_price, starting_price)')
      .eq('auto_pricing_enabled', true)
      .is('variant_id', null);

    if (productConfigsError) {
      console.warn('Error fetching product-level configs:', productConfigsError);
      // Don't throw - this is for backward compatibility only
    }

    // Transform to match the expected structure
    // Note: Supabase returns products as an object (not array) when using single select
    const productsWithConfigs = productLevelConfigs?.map((config: any) => {
      const product = config.products; // This is an object, not an array
      return {
        ...product,
        pricing_config: config,
      };
    }) || [];
    
    console.log(`🔍 [DEBUG] Product-level configs query result:`, {
      rawCount: productLevelConfigs?.length || 0,
      transformedCount: productsWithConfigs.length,
      sampleConfig: productLevelConfigs?.[0] ? {
        configId: productLevelConfigs[0].id,
        productId: productLevelConfigs[0].product_id,
        variantId: productLevelConfigs[0].variant_id,
        hasProducts: !!productLevelConfigs[0].products,
        productsKeys: productLevelConfigs[0].products ? Object.keys(productLevelConfigs[0].products) : [],
      } : null,
    });

    console.log(
      `🔍 Found ${variants?.length || 0} variants with pricing configs, ${productsWithConfigs?.length || 0} products with product-level configs`
    );

    // Handle products with product-level configs (products without variants)
    const enabledProducts: Array<{
      product: any;
      config: any;
    }> = [];
    
    if (productsWithConfigs && productsWithConfigs.length > 0) {
      productsWithConfigs.forEach((productWithConfig) => {
        // The config is already nested in pricing_config from the transform
        const config = productWithConfig.pricing_config;
        // Extract just the product data (without pricing_config to avoid confusion)
        const { pricing_config, ...product } = productWithConfig;
        
        if (config?.auto_pricing_enabled === true) {
          enabledProducts.push({ product, config });
        }
      });
      console.log(
        `🔍 Found ${enabledProducts.length} products with product-level configs to disable`
      );
    }

    if ((!variants || variants.length === 0) && (!productsWithConfigs || productsWithConfigs.length === 0)) {
      // Even if no variants or products found, still update global setting
      await supabaseAdmin
        .from('global_settings')
        .update({ value: false })
        .eq('key', 'smart_pricing_global_enabled');
      
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'No variants or products found to disable',
        variantSnapshots: [],
      });
    }

    // Filter to only variants where auto_pricing_enabled is currently true
    const enabledVariants = variants.filter((variant) => {
      const config = Array.isArray(variant.pricing_config)
        ? variant.pricing_config[0]
        : variant.pricing_config;
      return config?.auto_pricing_enabled === true;
    });

    console.log(
      `🔍 Found ${variants.length} total variants with pricing_config, ${enabledVariants.length} have auto_pricing_enabled=true`
    );

    // Build snapshots array (only for variants that were enabled)
    const snapshots = enabledVariants.map((variant) => {
      const config = Array.isArray(variant.pricing_config)
        ? variant.pricing_config[0]
        : variant.pricing_config;
      const priceToRevert = resolveBaselinePrice(
        {
          id: variant.id,
          product_id: variant.product_id,
          store_id: variant.store_id,
          shopify_id: variant.shopify_id,
          title: variant.title,
          current_price: variant.current_price,
          starting_price: variant.starting_price,
        },
        config
      );

      return {
        variantId: variant.id,
        shopifyId: variant.shopify_id,
        variantTitle: variant.title,
        price: variant.current_price,
        newPrice: priceToRevert,
        auto_pricing_enabled: true,
        current_state: config.current_state,
        next_price_change_date: config.next_price_change_date,
        revert_wait_until_date: config.revert_wait_until_date,
      };
    });

    // CRITICAL: Query product-level configs BEFORE bulk update
    // Otherwise bulk update will disable them before we can process them!
    // (This was already done above, but keeping this comment for clarity)
    
    // Check count before update (for logging)
    const { count: beforeCount } = await supabaseAdmin
      .from('pricing_config')
      .select('*', { count: 'exact', head: true })
      .eq('auto_pricing_enabled', true);

    console.log(
      `🔍 Found ${beforeCount || 0} pricing_config entries with auto_pricing_enabled=true (before bulk update)`
    );

    // Get store breakdown by querying variants and stores (for logging only)
    if (beforeCount && beforeCount > 0) {
      const { data: enabledConfigs } = await supabaseAdmin
        .from('pricing_config')
        .select(
          'variant_id, product_variants(store_id, stores(shop_domain))'
        )
        .eq('auto_pricing_enabled', true);

      if (enabledConfigs) {
        const storeBreakdown = new Map<string, number>();
        enabledConfigs.forEach((item: any) => {
          const storeDomain =
            item.product_variants?.stores?.shop_domain ||
            item.product_variants?.store_id ||
            'unknown';
          storeBreakdown.set(
            storeDomain,
            (storeBreakdown.get(storeDomain) || 0) + 1
          );
        });
        console.log(
          `📊 Store breakdown:`,
          Array.from(storeBreakdown.entries())
        );
      }
    }

    // NOTE: Bulk update is now moved to AFTER product-level processing
    // to ensure product-level configs are processed before being disabled

    // THEN: Process variants individually to revert prices (only for enabled ones)
    // But only revert prices for variants that were actually enabled
    const updateResults: Array<{
      variantId: string;
      shopifyId: string;
      variantTitle: string;
      success: boolean;
      priceReverted: number;
      error?: string;
    }> = [];

    await Promise.all(
      enabledVariants.map(async (variant) => {
        const config = Array.isArray(variant.pricing_config)
          ? variant.pricing_config[0]
          : variant.pricing_config;

        try {
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

          updateResults.push({
            variantId: variant.id,
            shopifyId: variant.shopify_id,
            variantTitle: variant.title,
            success: true,
            priceReverted: result.revertedTo,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(
            `❌ Failed to disable smart pricing for variant ${variant.id}:`,
            errorMessage
          );
          updateResults.push({
            variantId: variant.id,
            shopifyId: variant.shopify_id,
            variantTitle: variant.title,
            success: false,
            priceReverted: resolveBaselinePrice(
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
            ),
            error: errorMessage,
          });
        }
      })
    );

    // NOW: Bulk update ALL pricing_config entries to disabled
    // This happens AFTER we've collected all configs (both variant and product-level)
    const { error: bulkUpdateError, data: bulkUpdateData } = await supabaseAdmin
      .from('pricing_config')
      .update({
        auto_pricing_enabled: false,
        current_state: 'increasing',
        next_price_change_date: null,
        revert_wait_until_date: null,
      })
      .eq('auto_pricing_enabled', true)
      .select('id');

    if (bulkUpdateError) {
      console.error('❌ Bulk update error:', bulkUpdateError);
      throw bulkUpdateError;
    }

    console.log(`✅ Bulk update returned ${bulkUpdateData?.length || 0} updated rows`);

    // Process product-level configs (products without variants)
    const productUpdateResults: Array<{
      productId: string;
      shopifyId: string;
      productTitle: string;
      success: boolean;
      priceReverted: number;
      error?: string;
      warning?: string;
    }> = [];

    if (enabledProducts.length > 0) {
      console.log(`🔄 Processing ${enabledProducts.length} products with product-level configs...`);
      
      await Promise.all(
        enabledProducts.map(async ({ product, config }) => {
          const priceToRevert = config.pre_smart_pricing_price || product.starting_price;

          console.log(`🔍 [DEBUG] Product ${product.shopify_id}:`, {
            productId: product.id,
            currentPrice: product.current_price,
            startingPrice: product.starting_price,
            preSmartPrice: config.pre_smart_pricing_price,
            priceToRevert,
          });

          try {
            // Update pricing_config
            const { error: configUpdateError } = await supabaseAdmin
              .from('pricing_config')
              .update({
                auto_pricing_enabled: false,
                last_smart_pricing_price: product.current_price,
              })
              .eq('id', config.id);

            if (configUpdateError) {
              throw new Error(
                `Failed to update pricing config: ${configUpdateError.message}`
              );
            }

            // Update product price in database
            console.log(
              `💾 Updating product ${product.shopify_id} price in database: ${product.current_price} → ${priceToRevert}`
            );
            const { error: priceUpdateError } = await supabaseAdmin
              .from('products')
              .update({ current_price: priceToRevert })
              .eq('id', product.id);

            if (priceUpdateError) {
              throw new Error(
                `Failed to update product price: ${priceUpdateError.message}`
              );
            }

            const { error: historyError } = await supabaseAdmin
              .from('pricing_history')
              .insert({
                product_id: product.id,
                variant_id: null,
                store_id: product.store_id,
                old_price: product.current_price,
                new_price: priceToRevert,
                action: 'revert',
                reason: 'Smart pricing disabled',
              });

            if (historyError) {
              throw new Error(
                `Failed to record pricing history for product ${product.id}: ${historyError.message}`
              );
            }

            // SIMPLE MODEL: Every priced item = one variant entity
            // If product has no variants in our DB, fetch from Shopify and create it
            // Single-variant product = one entity, Multi-variant product = multiple entities
            let shopifyUpdateSuccess = false;
            let shopifyUpdateError: string | undefined;
            
            try {
              // Get store info
              const { data: storeData } = await supabaseAdmin
                .from('stores')
                .select('shop_domain, id')
                .eq('id', product.store_id)
                .single();

              if (!storeData) {
                throw new Error(`Store not found for product ${product.id}`);
              }

              // Fetch product from Shopify to get its first variant
              const tokens = await getDecryptedTokens(product.store_id);
              const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
              const baseUrl = `https://${storeData.shop_domain}/admin/api/${apiVersion}`;
              
              console.log(`🔍 Fetching product ${product.shopify_id} from Shopify to get variant...`);
              const productRes = await fetch(`${baseUrl}/products/${product.shopify_id}.json`, {
                headers: {
                  'X-Shopify-Access-Token': tokens.accessToken,
                  'Content-Type': 'application/json',
                },
                cache: 'no-store',
              });

              if (!productRes.ok) {
                throw new Error(`Failed to fetch product from Shopify: ${productRes.statusText}`);
              }

              const productData = await productRes.json();
              const firstVariant = productData.product?.variants?.[0];

              if (!firstVariant || !firstVariant.id) {
                throw new Error('Product has no variants in Shopify');
              }

              // Update the variant price in Shopify
              console.log(`🔄 Updating variant ${firstVariant.id} price in Shopify to ${priceToRevert}...`);
              const variantRes = await fetch(`${baseUrl}/variants/${firstVariant.id}.json`, {
                method: 'PUT',
                headers: {
                  'X-Shopify-Access-Token': tokens.accessToken,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  variant: {
                    id: firstVariant.id,
                    price: priceToRevert.toFixed(2),
                  },
                }),
                cache: 'no-store',
              });

              if (!variantRes.ok) {
                const errorText = await variantRes.text();
                throw new Error(`Failed to update Shopify variant: ${variantRes.statusText} - ${errorText}`);
              }

              shopifyUpdateSuccess = true;
              console.log(`✅ Successfully updated Shopify variant ${firstVariant.id} price to ${priceToRevert}`);

              // Optionally: Create the variant in our database for future use
              const { error: variantCreateError } = await supabaseAdmin
                .from('product_variants')
                .upsert({
                  store_id: product.store_id,
                  product_id: product.id,
                  shopify_id: firstVariant.id.toString(),
                  title: firstVariant.title || 'Default',
                  price: firstVariant.price?.toString() || priceToRevert.toFixed(2),
                  starting_price: parseFloat(firstVariant.price || priceToRevert.toFixed(2)),
                  current_price: priceToRevert,
                  compare_at_price: firstVariant.compare_at_price?.toString() || null,
                  sku: firstVariant.sku || null,
                  inventory_quantity: firstVariant.inventory_quantity || 0,
                  weight: firstVariant.weight || 0,
                  weight_unit: firstVariant.weight_unit || 'kg',
                  is_active: true,
                }, {
                  onConflict: 'shopify_id',
                });

              if (variantCreateError) {
                console.warn(`⚠️ Failed to create variant in database: ${variantCreateError.message}`);
                // Don't fail the whole operation - Shopify update succeeded
              } else {
                console.log(`✅ Created variant ${firstVariant.id} in database for future use`);
              }

            } catch (error) {
              shopifyUpdateError = error instanceof Error ? error.message : 'Unknown error';
              console.error(`❌ Failed to update Shopify for product ${product.shopify_id}:`, shopifyUpdateError);
              // Don't throw - database update succeeded, Shopify update is secondary
            }

            productUpdateResults.push({
              productId: product.id,
              shopifyId: product.shopify_id,
              productTitle: product.title,
              success: true,
              priceReverted: priceToRevert,
              ...(shopifyUpdateError && { error: `Shopify update failed: ${shopifyUpdateError}` }),
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Error processing product ${product.id}:`, errorMessage);
            productUpdateResults.push({
              productId: product.id,
              shopifyId: product.shopify_id,
              productTitle: product.title,
              success: false,
              priceReverted: priceToRevert,
              error: errorMessage,
            });
          }
        })
      );
    }

    // CRITICAL: Update global setting in Supabase
    await supabaseAdmin
      .from('global_settings')
      .update({ value: false })
      .eq('key', 'smart_pricing_global_enabled');

    const successCount = updateResults.filter((r) => r.success).length;
    const errorCount = updateResults.filter((r) => !r.success).length;
    const productSuccessCount = productUpdateResults.filter((r) => r.success).length;
    const productErrorCount = productUpdateResults.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      count: (variants?.length || 0) + (productsWithConfigs?.length || 0),
      enabledCount: enabledVariants.length + enabledProducts.length,
      message: `Disabled smart pricing for ${enabledVariants.length} variants and ${enabledProducts.length} products`,
      variantSnapshots: snapshots,
      updateResults: {
        total: updateResults.length,
        successful: successCount,
        failed: errorCount,
        details: updateResults,
      },
      productUpdateResults: {
        total: productUpdateResults.length,
        successful: productSuccessCount,
        failed: productErrorCount,
        details: productUpdateResults,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

