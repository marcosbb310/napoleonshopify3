// Diagnostic endpoint to check all possible reasons for "Product not found for this store"
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';
import { getVariantsByProductId } from '@/shared/lib/variantHelpers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    
    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'productId query parameter required',
      }, { status: 400 });
    }

    const diagnostics: Record<string, unknown> = {
      productId,
      productIdType: typeof productId,
      productIdLength: productId.length,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId),
      timestamp: new Date().toISOString(),
    };

    // Step 1: Check authentication and store
    const { user, store, error: authError } = await requireStore(request);
    
    diagnostics.step1_auth = {
      authenticated: !!user,
      hasStore: !!store,
      authError: authError ? 'Auth failed' : null,
      storeId: store?.id || null,
      storeName: store?.name || null,
      storeDomain: store?.shop_domain || null,
      xStoreIdHeader: request.headers.get('x-store-id') || null,
    };

    if (authError || !store) {
      return NextResponse.json({
        success: false,
        error: 'Authentication or store access failed',
        diagnostics,
      }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // Step 2: Check if product exists (by UUID)
    if (diagnostics.isUUID) {
      const { data: productByUuid, error: productUuidError } = await supabaseAdmin
        .from('products')
        .select('id, shopify_id, title, store_id, created_at')
        .eq('id', productId)
        .single();

      diagnostics.step2_productByUuid = {
        found: !!productByUuid,
        error: productUuidError?.message || null,
        product: productByUuid ? {
          id: productByUuid.id,
          shopify_id: productByUuid.shopify_id,
          title: productByUuid.title,
          store_id: productByUuid.store_id,
          storeMatches: productByUuid.store_id === store.id,
        } : null,
      };
    }

    // Step 3: Check if product exists (by Shopify ID)
    const { data: productByShopifyId, error: productShopifyError } = await supabaseAdmin
      .from('products')
      .select('id, shopify_id, title, store_id, created_at')
      .eq('shopify_id', productId)
      .single();

    diagnostics.step3_productByShopifyId = {
      found: !!productByShopifyId,
      error: productShopifyError?.message || null,
      product: productByShopifyId ? {
        id: productByShopifyId.id,
        shopify_id: productByShopifyId.shopify_id,
        title: productByShopifyId.title,
        store_id: productByShopifyId.store_id,
        storeMatches: productByShopifyId.store_id === store.id,
      } : null,
    };

    // Step 4: Check variants by product_id (UUID)
    if (diagnostics.isUUID) {
      const { data: variantsByProductId, error: variantsError } = await supabaseAdmin
        .from('product_variants')
        .select('id, product_id, store_id, shopify_id, shopify_product_id, title')
        .eq('product_id', productId)
        .eq('store_id', store.id);

      diagnostics.step4_variantsByProductId = {
        count: variantsByProductId?.length || 0,
        error: variantsError?.message || null,
        variants: variantsByProductId?.map(v => ({
          id: v.id,
          product_id: v.product_id,
          store_id: v.store_id,
          shopify_id: v.shopify_id,
          shopify_product_id: v.shopify_product_id,
          hasShopifyProductId: !!v.shopify_product_id,
        })) || [],
      };
    }

    // Step 5: Check variants by shopify_product_id
    const { data: variantsByShopifyProductId, error: variantsShopifyError } = await supabaseAdmin
      .from('product_variants')
      .select('id, product_id, store_id, shopify_id, shopify_product_id, title')
      .eq('shopify_product_id', productId)
      .eq('store_id', store.id);

    diagnostics.step5_variantsByShopifyProductId = {
      count: variantsByShopifyProductId?.length || 0,
      error: variantsShopifyError?.message || null,
      variants: variantsByShopifyProductId?.map(v => ({
        id: v.id,
        product_id: v.product_id,
        store_id: v.store_id,
        shopify_id: v.shopify_id,
        shopify_product_id: v.shopify_product_id,
      })) || [],
    };

    // Step 6: Try the actual function that's failing
    try {
      const variants = await getVariantsByProductId(productId, store.id);
      diagnostics.step6_getVariantsByProductId = {
        success: true,
        count: variants.length,
        variants: variants.map(v => ({
          id: v.id,
          product_id: v.product_id,
          store_id: v.store_id,
          shopify_id: v.shopify_id,
        })),
      };
    } catch (error) {
      diagnostics.step6_getVariantsByProductId = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      };
    }

    // Step 7: Check all products for this store (to see if product exists but wrong store)
    const { data: allStoreProducts, error: allProductsError } = await supabaseAdmin
      .from('products')
      .select('id, shopify_id, title, store_id')
      .eq('store_id', store.id)
      .limit(10);

    diagnostics.step7_allStoreProducts = {
      count: allStoreProducts?.length || 0,
      error: allProductsError?.message || null,
      sampleProducts: allStoreProducts?.map(p => ({
        id: p.id,
        shopify_id: p.shopify_id,
        title: p.title,
      })) || [],
    };

    // Step 8: Check if product exists in different store
    const { data: productInOtherStore, error: otherStoreError } = await supabaseAdmin
      .from('products')
      .select('id, shopify_id, title, store_id')
      .or(`id.eq.${productId},shopify_id.eq.${productId}`)
      .limit(5);

    diagnostics.step8_productInOtherStores = {
      found: (productInOtherStore?.length || 0) > 0,
      count: productInOtherStore?.length || 0,
      error: otherStoreError?.message || null,
      products: productInOtherStore?.map(p => ({
        id: p.id,
        shopify_id: p.shopify_id,
        title: p.title,
        store_id: p.store_id,
        belongsToRequestedStore: p.store_id === store.id,
      })) || [],
    };

    // Summary
    const summary = {
      productExists: !!(diagnostics.step2_productByUuid?.product || diagnostics.step3_productByShopifyId?.product),
      productInCorrectStore: diagnostics.step2_productByUuid?.product?.storeMatches || diagnostics.step3_productByShopifyId?.product?.storeMatches || false,
      variantsExist: (diagnostics.step4_variantsByProductId?.count || 0) > 0 || (diagnostics.step5_variantsByShopifyProductId?.count || 0) > 0,
      getVariantsFunctionWorks: diagnostics.step6_getVariantsByProductId?.success || false,
      productInWrongStore: diagnostics.step8_productInOtherStores?.found && !diagnostics.step8_productInOtherStores?.products?.some(p => p.belongsToRequestedStore),
    };

    diagnostics.summary = summary;

    return NextResponse.json({
      success: true,
      diagnostics,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      diagnostics: {
        error: error instanceof Error ? error.stack : String(error),
      },
    }, { status: 500 });
  }
}

