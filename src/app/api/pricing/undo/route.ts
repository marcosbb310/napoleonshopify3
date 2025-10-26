// Undo smart pricing toggle actions
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

interface ProductSnapshot {
  productId: string;
  shopifyId: string;
  price: number;
  auto_pricing_enabled: boolean;
  current_state?: string;
  next_price_change_date?: string | null;
  revert_wait_until_date?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const body = await request.json();
    const { productSnapshots } = body as { productSnapshots: ProductSnapshot[] };

    if (!productSnapshots || !Array.isArray(productSnapshots)) {
      return NextResponse.json(
        { success: false, error: 'productSnapshots array required' },
        { status: 400 }
      );
    }

    // Restore each product to its previous state
    for (const snapshot of productSnapshots) {
      // Update pricing config
      const configUpdates: Record<string, string | boolean | null> = {
        auto_pricing_enabled: snapshot.auto_pricing_enabled,
        current_state: snapshot.current_state || 'increasing',
      };

      if (snapshot.next_price_change_date !== undefined) {
        configUpdates.next_price_change_date = snapshot.next_price_change_date || null;
      }
      if (snapshot.revert_wait_until_date !== undefined) {
        configUpdates.revert_wait_until_date = snapshot.revert_wait_until_date || null;
      }

      await supabaseAdmin
        .from('pricing_config')
        .update(configUpdates)
        .eq('product_id', snapshot.productId);

      // Update product price
      await supabaseAdmin
        .from('products')
        .update({ current_price: snapshot.price })
        .eq('id', snapshot.productId);

      // Update Shopify
      await updateShopifyPrice(snapshot.shopifyId, snapshot.price);
    }

    return NextResponse.json({
      success: true,
      count: productSnapshots.length,
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

