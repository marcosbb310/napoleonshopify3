// Disable smart pricing globally for all products
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

export async function POST() {
  try {
    const supabaseAdmin = createAdminClient();
    // Get all products with smart pricing enabled
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('*, pricing_config!inner(*)')
      .eq('pricing_config.auto_pricing_enabled', true);

    if (error) throw error;

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'No products with smart pricing enabled',
        productSnapshots: [],
      });
    }

    // Build snapshots array
    const snapshots = products.map(product => {
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

    // Process all products in PARALLEL for much faster performance
    await Promise.all(
      products.map(async (product) => {
        const config = Array.isArray(product.pricing_config)
          ? product.pricing_config[0]
          : product.pricing_config;
        const priceToRevert = config.pre_smart_pricing_price || product.starting_price;

        // Run all 3 operations in parallel for this product
        await Promise.all([
          // Update pricing config
          supabaseAdmin
            .from('pricing_config')
            .update({
              last_smart_pricing_price: product.current_price,
              auto_pricing_enabled: false,
              current_state: 'increasing',
              next_price_change_date: null,
              revert_wait_until_date: null,
            })
            .eq('product_id', product.id),
          
          // Update product price
          supabaseAdmin
            .from('products')
            .update({ current_price: priceToRevert })
            .eq('id', product.id),
          
          // Update Shopify (don't wait for it, fire and forget)
          updateShopifyPrice(product.shopify_id, priceToRevert).catch(err => 
            console.error(`Failed to update Shopify for ${product.shopify_id}:`, err)
          ),
        ]);
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
  const storeUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN;
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

