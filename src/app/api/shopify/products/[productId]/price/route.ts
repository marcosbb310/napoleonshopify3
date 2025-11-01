import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';
import { getDecryptedTokens } from '@/features/shopify-oauth/services/tokenService';

/**
 * PUT /api/shopify/products/[productId]/price
 * 
 * Updates product price in both Shopify and Supabase
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    // Authenticate and get store
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const { productId } = await params;
    const body = await request.json();
    const { price, variantId } = body;

    if (!price || typeof price !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Valid price is required' },
        { status: 400 }
      );
    }

    // Get decrypted access token
    const tokens = await getDecryptedTokens(store.id);

    // Update Shopify
    const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
    const baseUrl = `https://${store.shop_domain}/admin/api/${apiVersion}`;
    
    // If no variantId provided, get it from product
    let actualVariantId = variantId;
    if (!actualVariantId) {
      const productRes = await fetch(`${baseUrl}/products/${productId}.json`, {
        headers: { 'X-Shopify-Access-Token': tokens.accessToken },
        cache: 'no-store',
      });
      
      if (!productRes.ok) {
        throw new Error(`Failed to fetch product: ${productRes.statusText}`);
      }
      
      const productData = await productRes.json();
      actualVariantId = productData.product?.variants?.[0]?.id;
      
      if (!actualVariantId) {
        throw new Error('No variant found for product');
      }
    }

    // Update variant price in Shopify
    const updateRes = await fetch(`${baseUrl}/variants/${actualVariantId}.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': tokens.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        variant: { 
          id: actualVariantId, 
          price: price.toFixed(2),
          compare_at_price: null,
        },
      }),
      cache: 'no-store',
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      throw new Error(`Shopify update failed: ${errorText}`);
    }

    // Update Supabase database
    const supabase = createAdminClient();
    
    // Find product by Shopify ID
    const { data: dbProduct } = await supabase
      .from('products')
      .select('id')
      .eq('store_id', store.id)
      .eq('shopify_id', productId)
      .single();

    if (!dbProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found in database' },
        { status: 404 }
      );
    }

    // Update product price in database
    const { error: updateError } = await supabase
      .from('products')
      .update({ current_price: price })
      .eq('id', dbProduct.id);

    if (updateError) {
      console.error('Failed to update database:', updateError);
      // Don't fail the request - Shopify was updated successfully
    }

    // Update variant price in database
    const { error: variantUpdateError } = await supabase
      .from('product_variants')
      .update({ price: price.toString() })
      .eq('product_id', dbProduct.id)
      .eq('shopify_id', actualVariantId);

    if (variantUpdateError) {
      console.error('Failed to update variant:', variantUpdateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Price updated successfully',
      data: { price, productId, variantId: actualVariantId },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Price update error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

