// Disable smart pricing globally for all products
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

export async function POST() {
  try {
    const supabaseAdmin = createAdminClient();
    // Get ALL products with pricing_config entries (not just enabled ones)
    // This ensures we catch products that may have been enabled after a previous disable
    // NOTE: We don't filter by is_active or store connection status to catch orphaned products
    // from disconnected stores that might still have pricing_config entries
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('*, pricing_config!inner(*)');

    if (error) throw error;

    if (!products || products.length === 0) {
      // Even if no products found, still update global setting
      await supabaseAdmin
        .from('global_settings')
        .update({ value: false })
        .eq('key', 'smart_pricing_global_enabled');
      
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'No products found to disable',
        productSnapshots: [],
      });
    }

    // Filter to only products where auto_pricing_enabled is currently true
    // We'll update all products with pricing_config, but only revert prices for enabled ones
    const enabledProducts = products.filter(product => {
      const config = Array.isArray(product.pricing_config)
        ? product.pricing_config[0]
        : product.pricing_config;
      return config?.auto_pricing_enabled === true;
    });

    console.log(`🔍 Found ${products.length} total products with pricing_config, ${enabledProducts.length} have auto_pricing_enabled=true`);

    // Build snapshots array (only for products that were enabled)
    const snapshots = enabledProducts.map(product => {
      const config = Array.isArray(product.pricing_config)
        ? product.pricing_config[0]
        : product.pricing_config;
      const priceToRevert = config.pre_smart_pricing_price || product.starting_price;

      return {
        productId: product.id,
        shopifyId: product.shopify_id,
        price: product.current_price,
        newPrice: priceToRevert,
        auto_pricing_enabled: true,
        current_state: config.current_state,
        next_price_change_date: config.next_price_change_date,
        revert_wait_until_date: config.revert_wait_until_date,
      };
    });

    // FIRST: Aggressively update ALL pricing_config entries to disabled
    // This catches any products that might have been missed or created during the process
    // Check count before update
    const { count: beforeCount } = await supabaseAdmin
      .from('pricing_config')
      .select('*', { count: 'exact', head: true })
      .eq('auto_pricing_enabled', true);

    console.log(`🔍 Found ${beforeCount || 0} pricing_config entries with auto_pricing_enabled=true before bulk update`);
    
    // Get store breakdown by querying products and stores
    if (beforeCount && beforeCount > 0) {
      const { data: enabledConfigs } = await supabaseAdmin
        .from('pricing_config')
        .select('product_id, products(store_id, stores(shop_domain))')
        .eq('auto_pricing_enabled', true);
      
      if (enabledConfigs) {
        const storeBreakdown = new Map<string, number>();
        enabledConfigs.forEach((item: any) => {
          const storeDomain = item.products?.stores?.shop_domain || item.products?.store_id || 'unknown';
          storeBreakdown.set(storeDomain, (storeBreakdown.get(storeDomain) || 0) + 1);
        });
        console.log(`📊 Store breakdown:`, Array.from(storeBreakdown.entries()));
      }
    }

    // Bulk update ALL entries with auto_pricing_enabled = true
    // Using admin client which should bypass RLS
    const { error: bulkUpdateError, data: bulkUpdateData } = await supabaseAdmin
      .from('pricing_config')
      .update({
        auto_pricing_enabled: false,
        current_state: 'increasing',
        next_price_change_date: null,
        revert_wait_until_date: null,
      })
      .eq('auto_pricing_enabled', true)
      .select('id'); // Select to verify update worked

    if (bulkUpdateError) {
      console.error('❌ Bulk update error:', bulkUpdateError);
      throw bulkUpdateError;
    }

    console.log(`✅ Bulk update returned ${bulkUpdateData?.length || 0} updated rows`);

    // Verify the update worked
    const { count: afterCount } = await supabaseAdmin
      .from('pricing_config')
      .select('*', { count: 'exact', head: true })
      .eq('auto_pricing_enabled', true);

    console.log(`✅ Bulk update completed. ${beforeCount || 0} entries targeted. Remaining enabled: ${afterCount || 0}`);

    if (afterCount && afterCount > 0) {
      console.warn(`⚠️ WARNING: ${afterCount} products still have auto_pricing_enabled=true after bulk update!`);
      
      // Get details about which products are still enabled
      const { data: stillEnabledConfigs } = await supabaseAdmin
        .from('pricing_config')
        .select('id, product_id, products(store_id, stores(shop_domain))')
        .eq('auto_pricing_enabled', true);
      
      if (stillEnabledConfigs && stillEnabledConfigs.length > 0) {
        const stillEnabledDetails = stillEnabledConfigs.map((item: any) => ({
          config_id: item.id,
          product_id: item.product_id,
          store_domain: item.products?.stores?.shop_domain || item.products?.store_id || 'unknown',
          store_id: item.products?.store_id || 'unknown',
        }));
        console.warn(`⚠️ Still enabled products:`, JSON.stringify(stillEnabledDetails, null, 2));
        
        // Group by store to see if it's store-specific
        const byStore = new Map<string, typeof stillEnabledDetails>();
        stillEnabledDetails.forEach(detail => {
          const key = detail.store_id || detail.store_domain;
          if (!byStore.has(key)) {
            byStore.set(key, []);
          }
          byStore.get(key)!.push(detail);
        });
        
        console.log(`📊 Problem products grouped by store:`, Array.from(byStore.entries()).map(([store, products]) => ({
          store,
          count: products.length
        })));
        
        // Try updating each one individually as fallback - using config_id for more reliable update
        console.log('🔄 Attempting individual updates for remaining products...');
        for (const detail of stillEnabledDetails) {
          // Try by config_id first (most reliable)
          let updateError = null;
          const { error: configIdError } = await supabaseAdmin
            .from('pricing_config')
            .update({ 
              auto_pricing_enabled: false,
              current_state: 'increasing',
              next_price_change_date: null,
              revert_wait_until_date: null,
            })
            .eq('id', detail.config_id);
          
          if (configIdError) {
            updateError = configIdError;
            // Fallback: try by product_id
            const { error: productIdError } = await supabaseAdmin
              .from('pricing_config')
              .update({ 
                auto_pricing_enabled: false,
                current_state: 'increasing',
                next_price_change_date: null,
                revert_wait_until_date: null,
              })
              .eq('product_id', detail.product_id);
            
            if (productIdError) {
              console.error(`❌ Both update methods failed for config ${detail.config_id} / product ${detail.product_id} (store: ${detail.store_domain}):`, {
                configIdError,
                productIdError
              });
            } else {
              console.log(`✅ Fixed product ${detail.product_id} from store ${detail.store_domain} (using product_id)`);
            }
          } else {
            console.log(`✅ Fixed config ${detail.config_id} for product ${detail.product_id} from store ${detail.store_domain}`);
          }
        }
        
        // Final verification after individual updates
        const { count: finalCount } = await supabaseAdmin
          .from('pricing_config')
          .select('*', { count: 'exact', head: true })
          .eq('auto_pricing_enabled', true);
        
        console.log(`🎯 Final count after individual updates: ${finalCount || 0} products still enabled`);
      }
    }

    // THEN: Process products individually to revert prices (only for enabled ones)
    // But only revert prices for products that were actually enabled
    await Promise.all(
      enabledProducts.map(async (product) => {
        const config = Array.isArray(product.pricing_config)
          ? product.pricing_config[0]
          : product.pricing_config;
        
        const priceToRevert = config.pre_smart_pricing_price || product.starting_price;

        try {
          // Save last price before reverting
          const { error: savePriceError } = await supabaseAdmin
            .from('pricing_config')
            .update({ last_smart_pricing_price: product.current_price })
            .eq('product_id', product.id);

          if (savePriceError) {
            console.error(`❌ Failed to save last price for ${product.id}:`, savePriceError);
          }

          // Update product price
          const { error: priceUpdateError } = await supabaseAdmin
            .from('products')
            .update({ current_price: priceToRevert })
            .eq('id', product.id);

          if (priceUpdateError) {
            console.error(`❌ Failed to update product price for ${product.id}:`, priceUpdateError);
          }

          // Update Shopify (don't wait for it, fire and forget)
          updateShopifyPrice(product.shopify_id, priceToRevert).catch(err => 
            console.error(`❌ Failed to update Shopify for ${product.shopify_id}:`, err)
          );
        } catch (error) {
          console.error(`❌ Error processing product ${product.id}:`, error);
        }
      })
    );

    // CRITICAL: Update global setting in Supabase
    await supabaseAdmin
      .from('global_settings')
      .update({ value: false })
      .eq('key', 'smart_pricing_global_enabled');

    return NextResponse.json({
      success: true,
      count: products.length,
      enabledCount: enabledProducts.length,
      message: `Disabled smart pricing for ${products.length} products (${enabledProducts.length} had prices reverted)`,
      productSnapshots: snapshots,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

async function updateShopifyPrice(shopifyId: string, newPrice: number) {
  const storeUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
  const accessToken = process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';

  if (!storeUrl || !accessToken) return;

  const baseUrl = `https://${storeUrl}/admin/api/${apiVersion}`;

  try {
    const productRes = await fetch(`${baseUrl}/products/${shopifyId}.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
      cache: 'no-store',
    });

    if (!productRes.ok) return;

    const productData = await productRes.json();
    const variantId = productData.product?.variants?.[0]?.id;

    if (!variantId) return;

    await fetch(`${baseUrl}/variants/${variantId}.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        variant: {
          id: variantId,
          price: newPrice.toFixed(2),
          compare_at_price: null,
        },
      }),
    });
  } catch (err) {
    console.error(`Failed to update Shopify price for ${shopifyId}:`, err);
  }
}

