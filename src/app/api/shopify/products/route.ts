import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';

export async function GET(request: NextRequest) {
  console.log('🖼️🖼️🖼️ [API] /api/shopify/products GET called 🖼️🖼️🖼️');
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    console.log('🔍 [API] Fetching products for store:', {
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
    
    // DEBUG: Check what Shopify is returning for images
    if (data.products && data.products.length > 0) {
      const firstProduct = data.products[0] as Record<string, unknown>;
      console.log('🖼️ [API] First product from Shopify:', {
        title: firstProduct.title,
        hasImages: !!firstProduct.images,
        imagesType: typeof firstProduct.images,
        imagesIsArray: Array.isArray(firstProduct.images),
        imageCount: Array.isArray(firstProduct.images) ? firstProduct.images.length : 0,
        firstImage: Array.isArray(firstProduct.images) && firstProduct.images.length > 0 ? firstProduct.images[0] : null,
      });
    }
    
    // Transform Shopify API response to match our expected format
    const transformedProducts = data.products?.map((product: Record<string, unknown>) => {
      const images = product.images?.map((image: Record<string, unknown>) => ({
        id: image.id.toString(),
        productId: product.id.toString(),
        src: image.src,
        alt: image.alt || '',
        width: image.width || 800,
        height: image.height || 800,
      })) || [];
      
      // DEBUG: Log transformed images for first product
      if (product === data.products[0]) {
        console.log('🖼️ [API] Transformed images for first product:', {
          title: product.title,
          imageCount: images.length,
          firstImage: images[0] || null,
        });
      }
      
      return {
        id: product.id.toString(),
        title: product.title,
        handle: product.handle,
        description: product.body_html || '',
        vendor: product.vendor || '',
        productType: product.product_type || '',
        tags: product.tags ? product.tags.split(',').map((tag: string) => tag.trim()) : [],
        status: product.status as 'active' | 'draft' | 'archived',
        images,
      variants: product.variants?.map((variant: Record<string, unknown>) => {
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
      };
    }) || [];

    // CRITICAL: Lookup dbId from database for each product
    // This allows frontend to use dbId for API calls
    const supabaseAdmin = createAdminClient();
    const shopifyIds = transformedProducts.map(p => p.id);
    
    console.log('🔍 [API] Looking up dbIds for products:', {
      totalProductsFromShopify: transformedProducts.length,
      shopifyIdsCount: shopifyIds.length,
      sampleShopifyIds: shopifyIds.slice(0, 3),
      storeId: store.id,
      storeDomain: store.shop_domain,
    });
    
    if (shopifyIds.length > 0) {
      const { data: dbProducts, error: dbError } = await supabaseAdmin
        .from('products')
        .select('id, shopify_id')
        .eq('store_id', store.id)
        .in('shopify_id', shopifyIds);
      
      if (dbError) {
        console.error('❌ [API] Failed to lookup dbIds from database:', {
          error: dbError.message,
          code: dbError.code,
          details: dbError.details,
          hint: dbError.hint,
          storeId: store.id,
          shopifyIdsCount: shopifyIds.length,
        });
        // Continue without dbId lookup - return products without dbId
      } else {
        // Create a map for quick lookup: shopify_id → dbId (UUID)
        const dbIdMap = new Map(
          dbProducts?.map(p => [p.shopify_id, p.id]) || []
        );
        
        console.log('📊 [API] Database lookup results:', {
          productsFoundInDb: dbProducts?.length || 0,
          productsFromShopify: shopifyIds.length,
          matchRate: dbProducts?.length ? `${((dbProducts.length / shopifyIds.length) * 100).toFixed(1)}%` : '0%',
          storeId: store.id,
        });
        
        if (dbProducts && dbProducts.length > 0) {
          console.log('🔍 [API] Sample database products:', dbProducts.slice(0, 3).map(p => ({
            dbId: p.id,
            shopify_id: p.shopify_id,
          })));
        } else {
          console.warn('⚠️ [API] NO products found in database for this store!', {
            storeId: store.id,
            storeDomain: store.shop_domain,
            shopifyIdsCount: shopifyIds.length,
            message: 'Products need to be synced to database first. Run a product sync.',
          });
        }
        
        // Add dbId to each product
        const productsWithDbId = transformedProducts.map(product => ({
          ...product,
          dbId: dbIdMap.get(product.id) || null,  // Add dbId (UUID) or null if not in database
        }));
        
        // Count products with and without dbId
        const withDbId = productsWithDbId.filter(p => p.dbId);
        const withoutDbId = productsWithDbId.filter(p => !p.dbId);
        
        console.log('✅ [API] Final product breakdown:', {
          totalProducts: productsWithDbId.length,
          withDbId: withDbId.length,
          withoutDbId: withoutDbId.length,
          dbIdCoverage: `${((withDbId.length / productsWithDbId.length) * 100).toFixed(1)}%`,
        });
        
        // Log sample to verify
        if (withDbId.length > 0) {
          const sample = withDbId[0];
          console.log('✅ [API] Sample product WITH dbId:', {
            title: sample.title,
            id: sample.id,  // Shopify ID
            dbId: sample.dbId,  // Database UUID
            dbIdIsUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sample.dbId || ''),
          });
        }
        
        if (withoutDbId.length > 0) {
          const sample = withoutDbId[0];
          console.warn('⚠️ [API] Sample product WITHOUT dbId:', {
            title: sample.title,
            id: sample.id,  // Shopify ID
            dbId: sample.dbId,  // Should be null
            message: 'This product is not in your database. Run a product sync.',
          });
        }
        
        return NextResponse.json({ success: true, data: productsWithDbId }, { status: 200 });
      }
    }

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

