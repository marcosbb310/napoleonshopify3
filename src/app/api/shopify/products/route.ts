import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const storeUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || process.env.SHOPIFY_STORE_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || process.env.SHOPIFY_API_VERSION || '2024-10';

    if (!storeUrl || !accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Missing Shopify credentials on server. Set SHOPIFY_ACCESS_TOKEN and NEXT_PUBLIC_SHOPIFY_STORE_URL.',
            statusCode: 500,
          },
        },
        { status: 500 },
      );
    }

    const baseUrl = `https://${storeUrl}/admin/api/${apiVersion}`;

    const res = await fetch(`${baseUrl}/products.json?limit=250`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
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
      return NextResponse.json(
        { success: false, error: { message: errorMessage, statusCode: res.status } },
        { status: res.status },
      );
    }

    const data = await res.json();
    
    // Transform Shopify API response to match our expected format
    const transformedProducts = data.products?.map((product: any) => ({
      id: product.id.toString(),
      title: product.title,
      handle: product.handle,
      description: product.body_html || '',
      vendor: product.vendor || '',
      productType: product.product_type || '',
      tags: product.tags ? product.tags.split(',').map((tag: string) => tag.trim()) : [],
      status: product.status as 'active' | 'draft' | 'archived',
      images: product.images?.map((image: any) => ({
        id: image.id.toString(),
        productId: product.id.toString(),
        src: image.src,
        alt: image.alt || '',
        width: image.width || 800,
        height: image.height || 800,
      })) || [],
      variants: product.variants?.map((variant: any) => {
        // Validate and sanitize price values
        const price = parseFloat(variant.price) || 0;
        const compareAtPrice = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
        
        // Cap prices at reasonable maximum to prevent frontend issues
        const maxPrice = 999999.99;
        const sanitizedPrice = Math.min(price, maxPrice);
        const sanitizedCompareAtPrice = compareAtPrice ? Math.min(compareAtPrice, maxPrice) : null;
        
        return {
          id: variant.id.toString(),
          productId: product.id.toString(),
          title: variant.title,
          sku: variant.sku || '',
          price: sanitizedPrice.toString(),
          compareAtPrice: sanitizedCompareAtPrice?.toString() || null,
          inventoryQuantity: variant.inventory_quantity || 0,
          inventoryManagement: variant.inventory_management,
          weight: variant.weight,
          weightUnit: variant.weight_unit as 'g' | 'kg' | 'oz' | 'lb',
          image: variant.image ? {
            id: variant.image.id.toString(),
            productId: product.id.toString(),
            src: variant.image.src,
            alt: variant.image.alt || '',
            width: variant.image.width || 800,
            height: variant.image.height || 800,
          } : undefined,
          createdAt: variant.created_at,
          updatedAt: variant.updated_at,
        };
      }) || [],
      createdAt: product.created_at,
      updatedAt: product.updated_at,
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
    const storeUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || process.env.SHOPIFY_STORE_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || process.env.SHOPIFY_API_VERSION || '2024-10';

    if (!storeUrl || !accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Missing Shopify credentials on server. Set SHOPIFY_ACCESS_TOKEN and NEXT_PUBLIC_SHOPIFY_STORE_URL.',
            statusCode: 500,
          },
        },
        { status: 500 },
      );
    }

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
        variants: (variants || []).map((v: any) => ({
          title: v.title || 'Default',
          price: v.price || '0.00',
          compare_at_price: v.compareAtPrice || null,
          sku: v.sku || '',
          inventory_quantity: v.inventoryQuantity || 0,
          inventory_management: v.inventoryManagement || null,
          weight: v.weight || null,
          weight_unit: v.weightUnit || 'kg',
        })),
        images: (images || []).map((img: any) => ({
          src: img.src,
          alt: img.alt || '',
        })),
      },
    };

    const baseUrl = `https://${storeUrl}/admin/api/${apiVersion}`;

    const res = await fetch(`${baseUrl}/products.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
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


