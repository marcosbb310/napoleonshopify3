import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    console.log('🔍 Fetching products for store:', {
      storeId: store.id,
      shopDomain: store.shop_domain,
      hasToken: !!store.access_token,
      tokenLength: store.access_token?.length,
      scope: store.scope
    });

    const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
    const baseUrl = `https://${store.shop_domain}/admin/api/${apiVersion}`;

    const res = await fetch(`${baseUrl}/products.json?limit=250`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': store.access_token, // NEW AUTH: Use decrypted token from store
      },
      // Ensure server-side fetch, not cached
      cache: 'no-store',
    });

    if (!res.ok) {
      let errorMessage: string = `Shopify request failed with status ${res.status}`;
      try {
        const err = await res.json();
        if (err && err.errors) {
          errorMessage = typeof err.errors === 'string' ? err.errors : JSON.stringify(err.errors);
        }
      } catch {
        // ignore JSON parse error
      }
      
      // Log diagnostic info for 403 errors (invalid token)
      if (res.status === 403) {
        console.error('❌ Shopify 403 Error:', {
          storeId: store.id,
          shopDomain: store.shop_domain,
          tokenLength: store.access_token?.length,
          message: errorMessage,
        });
        
        // Provide user-friendly error message for 403
        errorMessage = 'Your Shopify access token is invalid or expired. Please reconnect your store in Settings.';
      }
      
      return NextResponse.json(
        { success: false, error: { message: errorMessage, statusCode: res.status } },
        { status: res.status },
      );
    }

    const data = await res.json();
    
    // Transform Shopify API response to match our expected format
    const transformedProducts = data.products?.map((product: Record<string, unknown>) => ({
      id: (product.id as string) || '',
      title: (product.title as string) || '',
      handle: (product.handle as string) || '',
      description: (product.body_html as string) || '',
      vendor: (product.vendor as string) || '',
      productType: (product.product_type as string) || '',
      tags: (product.tags as string) ? (product.tags as string).split(',').map((tag: string) => tag.trim()) : [],
      status: (product.status as 'active' | 'draft' | 'archived') || 'active',
      images: (product.images as Record<string, unknown>[])?.map((image: Record<string, unknown>) => ({
        id: (image.id as string) || '',
        productId: (product.id as string) || '',
        src: (image.src as string) || '',
        alt: (image.alt as string) || '',
        width: (image.width as number) || 800,
        height: (image.height as number) || 800,
      })) || [],
      variants: (product.variants as Record<string, unknown>[])?.map((variant: Record<string, unknown>) => {
        // Validate and sanitize price values
        const price = parseFloat((variant.price as string) || '0') || 0;
        const compareAtPrice = variant.compare_at_price ? parseFloat((variant.compare_at_price as string) || '0') : null;
        
        // Cap prices at reasonable maximum to prevent frontend issues
        const maxPrice = 999999.99;
        const sanitizedPrice = Math.min(price, maxPrice);
        const sanitizedCompareAtPrice = compareAtPrice ? Math.min(compareAtPrice, maxPrice) : null;
        
        return {
          id: (variant.id as string) || '',
          productId: (product.id as string) || '',
          title: (variant.title as string) || '',
          sku: (variant.sku as string) || '',
          price: sanitizedPrice.toString(),
          compareAtPrice: sanitizedCompareAtPrice?.toString() || null,
          inventoryQuantity: (variant.inventory_quantity as number) || 0,
          inventoryManagement: (variant.inventory_management as string) || '',
          weight: (variant.weight as number) || 0,
          weightUnit: (variant.weight_unit as 'g' | 'kg' | 'oz' | 'lb') || 'g',
          image: variant.image ? {
            id: ((variant.image as Record<string, unknown>).id as string) || '',
            productId: (product.id as string) || '',
            src: ((variant.image as Record<string, unknown>).src as string) || '',
            alt: ((variant.image as Record<string, unknown>).alt as string) || '',
            width: ((variant.image as Record<string, unknown>).width as number) || 800,
            height: ((variant.image as Record<string, unknown>).height as number) || 800,
          } : undefined,
          createdAt: (variant.created_at as string) || '',
          updatedAt: (variant.updated_at as string) || '',
        };
      }) || [],
      createdAt: (product.created_at as string) || '',
      updatedAt: (product.updated_at as string) || '',
    })) || [];

    return NextResponse.json({ success: true, data: transformedProducts }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      { success: false, error: { message, statusCode: 500 } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
    const body = await request.json();
    const { title, description, vendor, productType, tags, status, variants, images } = body;

    // Build Shopify product payload
    const productPayload = {
      product: {
        title,
        body_html: description || '',
        vendor: vendor || '',
        product_type: productType || '',
        tags: Array.isArray(tags) ? tags.join(', ') : (tags || ''),
        status: status || 'active',
        variants: (variants || []).map((v: Record<string, unknown>) => ({
          title: v.title || 'Default',
          price: v.price || '0.00',
          compare_at_price: v.compareAtPrice || null,
          sku: v.sku || '',
          inventory_quantity: v.inventoryQuantity || 0,
          inventory_management: v.inventoryManagement || null,
          weight: v.weight || null,
          weight_unit: v.weightUnit || 'kg',
        })),
        images: (images || []).map((img: Record<string, unknown>) => ({
          src: img.src,
          alt: img.alt || '',
        })),
      },
    };

    const baseUrl = `https://${store.shop_domain}/admin/api/${apiVersion}`;

    const res = await fetch(`${baseUrl}/products.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': store.access_token, // NEW AUTH: Use decrypted token
      },
      body: JSON.stringify(productPayload),
      cache: 'no-store',
    });

    if (!res.ok) {
      let errorMessage: string = `Shopify create failed with status ${res.status}`;
      try {
        const err = await res.json();
        if (err && err.errors) {
          errorMessage = typeof err.errors === 'string' ? err.errors : JSON.stringify(err.errors);
        }
      } catch {
        // ignore JSON parse error
      }
      return NextResponse.json(
        { success: false, error: { message: errorMessage, statusCode: res.status } },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, data: data.product }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      { success: false, error: { message, statusCode: 500 } },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
    const body = await request.json();
    const { productIds } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Product IDs are required', statusCode: 400 } },
        { status: 400 },
      );
    }

    const baseUrl = `https://${store.shop_domain}/admin/api/${apiVersion}`;

    // Delete each product
    const deletePromises = productIds.map(async (productId: string) => {
      const res = await fetch(`${baseUrl}/products/${productId}.json`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': store.access_token, // NEW AUTH: Use decrypted token
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        let errorMessage: string = `Failed to delete product ${productId}`;
        try {
          const err = await res.json();
          if (err && err.errors) {
            errorMessage = typeof err.errors === 'string' ? err.errors : JSON.stringify(err.errors);
          }
        } catch {
          // ignore JSON parse error
        }
        return { success: false, productId, error: errorMessage };
      }

      return { success: true, productId };
    });

    const results = await Promise.all(deletePromises);
    const failedDeletes = results.filter(r => !r.success);

    if (failedDeletes.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: `Failed to delete ${failedDeletes.length} product(s)`, 
            statusCode: 500,
            details: failedDeletes,
          } 
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { deletedCount: productIds.length } }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      { success: false, error: { message, statusCode: 500 } },
      { status: 500 },
    );
  }
}

