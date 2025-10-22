// Resume smart pricing with user's choice
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

export async function POST(request: NextRequest) {
  try {
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

    // Try to find product by UUID first, then by Shopify ID
    let product: any = null;
    let productError: any = null;
    
    // First try as UUID
    const uuidResult = await supabaseAdmin
      .from('products')
      .select('*, pricing_config(*)')
      .eq('id', productId)
      .single();
    
    if (!uuidResult.error && uuidResult.data) {
      product = uuidResult.data;
    } else {
      // Try as Shopify ID
      const shopifyResult = await supabaseAdmin
        .from('products')
        .select('*, pricing_config(*)')
        .eq('shopify_id', productId)
        .single();
      
      if (!shopifyResult.error && shopifyResult.data) {
        product = shopifyResult.data;
      } else {
        productError = shopifyResult.error;
      }
    }

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    const config = Array.isArray(product.pricing_config)
      ? product.pricing_config[0]
      : product.pricing_config;

    // Determine price based on choice
    const newPrice = resumeOption === 'base'
      ? config.pre_smart_pricing_price || product.starting_price
      : config.last_smart_pricing_price || product.current_price;

    // Update pricing config
    await supabaseAdmin
      .from('pricing_config')
      .update({
        auto_pricing_enabled: true,
        current_state: 'increasing',
        revert_wait_until_date: null,
      })
      .eq('product_id', product.id);

    // Update product price
    await supabaseAdmin
      .from('products')
      .update({ current_price: newPrice })
      .eq('id', productId);

    // Update Shopify
    await updateShopifyPrice(product.shopify_id, newPrice);

    return NextResponse.json({
      success: true,
      price: newPrice,
      resumeOption,
      snapshot: {
        productId,
        price: product.current_price,
        auto_pricing_enabled: false,
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

async function updateShopifyPrice(shopifyId: string, newPrice: number) {
  const storeUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';

  if (!storeUrl || !accessToken) throw new Error('Missing Shopify credentials');

  const baseUrl = `https://${storeUrl}/admin/api/${apiVersion}`;

  const productRes = await fetch(`${baseUrl}/products/${shopifyId}.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
    cache: 'no-store',
  });

  if (!productRes.ok) throw new Error(`Failed to fetch product`);

  const productData = await productRes.json();
  const variantId = productData.product?.variants?.[0]?.id;

  if (!variantId) throw new Error('No variant found');

  const updateRes = await fetch(`${baseUrl}/variants/${variantId}.json`, {
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

  if (!updateRes.ok) throw new Error(`Failed to update price`);
}

