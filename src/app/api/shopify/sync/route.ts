import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createRouteHandlerClient } from '@/shared/lib/supabase';
import { syncProductsFromShopify } from '@/features/shopify-integration/services/syncProducts';
import { getDecryptedTokens } from '@/features/shopify-oauth/services/tokenService';

/**
 * POST /api/shopify/sync
 * 
 * Triggers product sync from Shopify to local database
 * 
 * Request body:
 * {
 *   "storeId": "store-uuid"
 * }
 */
export async function POST(request: NextRequest) {
  console.log('🟢 SYNC API: Request received');
  try {
    console.log('🟢 SYNC API: Inside try block');
    
    // Parse request body to get storeId FIRST (before requireStore)
    const body = await request.json();
    console.log('🟢 SYNC API: Request body:', body);
    const { storeId } = body;

    if (!storeId) {
      console.log('🟢 SYNC API: Missing storeId');
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      );
    }

    console.log('🟢 SYNC API: Store ID:', storeId);

    // Use requireStore() helper with storeId from body (standardized auth pattern)
    // Pass storeId directly in options to avoid body consumption issues
    // Note: requireAuth() only needs headers, not body, so this should work
    const { user, store, error: storeError } = await requireStore(request, { storeId });
    
    if (storeError) {
      console.log('🟢 SYNC API: Store validation failed:', storeError);
      return storeError;
    }

    if (!store) {
      console.log('🟢 SYNC API: Store not found');
      return NextResponse.json(
        { success: false, error: 'Store not found or access denied' },
        { status: 404 }
      );
    }
    
    console.log('🟢 SYNC API: Store found:', store.shop_domain);

    // Get decrypted access token
    console.log('🟢 SYNC API: Getting tokens...');
    const tokens = await getDecryptedTokens(storeId);

    // Trigger product sync
    console.log('🟢 SYNC API: Calling syncProductsFromShopify...');
    const result = await syncProductsFromShopify(
      storeId,
      store.shop_domain,
      tokens.accessToken
    );
    
    console.log('🟢 SYNC API: Sync completed:', {
      success: result.success,
      totalProducts: result.totalProducts,
      syncedProducts: result.syncedProducts,
      skippedProducts: result.skippedProducts,
      errors: result.errors.length
    });

    // Get image stats from database after sync
    const supabase = createRouteHandlerClient(request);
    const { data: imageStats } = await supabase
      .from('products')
      .select('id, images')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .limit(10);

    const productsWithImages = imageStats?.filter(p => 
      p.images && Array.isArray(p.images) && p.images.length > 0
    ) || [];

    console.log(`🖼️  SYNC API: After sync - ${productsWithImages.length}/${imageStats?.length || 0} products have images`);

    return NextResponse.json({
      success: result.success,
      data: {
        totalProducts: result.totalProducts,
        syncedProducts: result.syncedProducts,
        skippedProducts: result.skippedProducts,
        duration: result.duration,
        errors: result.errors,
        invalidProducts: result.invalidProducts,
        debug: {
          productsWithImages: productsWithImages.length,
          totalProductsChecked: imageStats?.length || 0,
          sampleProductImages: imageStats?.[0]?.images || null,
        },
      },
      error: result.success ? null : result.errors.join(', '),
    });

  } catch (error) {
    console.error('Product sync error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}