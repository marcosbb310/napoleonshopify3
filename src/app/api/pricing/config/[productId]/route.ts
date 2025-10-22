// API endpoints for pricing configuration management
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';

// GET pricing config for a product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error: authError } = await requireStore(request);
    if (authError) return authError;

    const { productId } = await params;
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .select('*')
      .eq('product_id', productId)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, config: data });
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
    // NEW AUTH: Require authenticated store
    const { user, store, error: authError } = await requireStore(request);
    if (authError) return authError;

    const { productId } = await params;
    const body = await request.json();
    const supabaseAdmin = createAdminClient();

    // Check if this is a smart pricing toggle
    if (body.auto_pricing_enabled !== undefined) {
      return handleSmartPricingToggle(productId, body.auto_pricing_enabled);
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

    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .update(updates)
      .eq('product_id', productId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration updated',
      config: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Handle smart pricing toggle logic
async function handleSmartPricingToggle(productId: string, enabled: boolean) {
  try {
    // Try to find product by UUID first, then by Shopify ID
    let product: Record<string, unknown> | null = null;
    let productError: unknown = null;
    
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

    if (enabled) {
      // TURNING ON smart pricing
      // If first time, set pre_smart_pricing_price
      if (!config.pre_smart_pricing_price) {
        await supabaseAdmin
          .from('pricing_config')
          .update({ pre_smart_pricing_price: product.current_price })
          .eq('product_id', productId);
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
    } else {
      // TURNING OFF smart pricing
      const priceToRevert = config.pre_smart_pricing_price || product.starting_price;

      // Store current price as last_smart_pricing_price
      await supabaseAdmin
        .from('pricing_config')
        .update({
          last_smart_pricing_price: product.current_price,
          auto_pricing_enabled: false,
          current_state: 'increasing',
          revert_wait_until_date: null,
        })
        .eq('product_id', productId);

      // Update product price
      await supabaseAdmin
        .from('products')
        .update({ current_price: priceToRevert })
        .eq('id', productId);

      // Update Shopify
      await updateShopifyPrice(product.shopify_id, priceToRevert);

      return NextResponse.json({
        success: true,
        reverted: true,
        revertedTo: priceToRevert,
        snapshot: {
          productId,
          price: product.current_price,
          auto_pricing_enabled: true,
          state: config.current_state,
          revert_wait_until_date: config.revert_wait_until_date,
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Update price in Shopify
async function updateShopifyPrice(shopifyId: string, newPrice: number) {
  const storeUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';

  if (!storeUrl || !accessToken) throw new Error('Missing Shopify credentials');

  const baseUrl = `https://${storeUrl}/admin/api/${apiVersion}`;

  // Get product to find variant ID
  const productRes = await fetch(`${baseUrl}/products/${shopifyId}.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
    cache: 'no-store',
  });

  if (!productRes.ok) throw new Error(`Failed to fetch product: ${productRes.statusText}`);

  const productData = await productRes.json();
  const variantId = productData.product?.variants?.[0]?.id;

  if (!variantId) throw new Error('No variant found');

  // Update variant price
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

  if (!updateRes.ok) throw new Error(`Failed to update price: ${updateRes.statusText}`);
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

    if (!newMaxPercentage || typeof newMaxPercentage !== 'number') {
      return NextResponse.json(
        { success: false, error: 'newMaxPercentage is required and must be a number' },
        { status: 400 }
      );
    }

    // Update max cap and reset state to increasing
    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .update({
        max_increase_percentage: newMaxPercentage,
        current_state: 'increasing',
      })
      .eq('product_id', productId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Max cap increased to ${newMaxPercentage}%`,
      config: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

