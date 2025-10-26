import { NextRequest, NextResponse } from 'next/server';
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
  try {
    // Verify user is authenticated
    const supabase = createRouteHandlerClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!user || authError) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { storeId } = body;

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      );
    }

    // Get store information
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, shop_domain, user_id')
      .eq('id', storeId)
      .eq('is_active', true)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404 }
      );
    }

    // Verify store belongs to user
    const { data: userProfile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!userProfile || store.user_id !== userProfile.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get decrypted access token
    const tokens = await getDecryptedTokens(storeId);

    // Trigger product sync
    const result = await syncProductsFromShopify(
      storeId,
      store.shop_domain,
      tokens.accessToken
    );

    return NextResponse.json({
      success: result.success,
      data: {
        totalProducts: result.totalProducts,
        syncedProducts: result.syncedProducts,
        duration: result.duration,
        errors: result.errors,
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