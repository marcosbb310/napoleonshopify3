import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/shared/lib/supabase';
import { ShopifyClient } from '@/features/shopify-integration/services/shopifyClient';
import { getDecryptedTokens } from '@/features/shopify-oauth/services/tokenService';

/**
 * POST /api/shopify/test-sync
 * 
 * Diagnostic endpoint to test product sync
 * Returns detailed information about each step
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Starting sync diagnostic...');
    
    // 1. Verify authentication
    const supabase = createRouteHandlerClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!user || authError) {
      return NextResponse.json({
        success: false,
        step: 'authentication',
        error: 'Authentication required',
        details: { authError },
      }, { status: 401 });
    }
    
    console.log('✅ User authenticated:', user.id);

    // 2. Parse request body
    const body = await request.json();
    const { storeId } = body;

    if (!storeId) {
      return NextResponse.json({
        success: false,
        step: 'validation',
        error: 'Store ID is required',
      }, { status: 400 });
    }

    console.log('✅ Store ID provided:', storeId);

    // 3. Get store information
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, shop_domain, user_id, is_active')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json({
        success: false,
        step: 'store_lookup',
        error: 'Store not found',
        details: { storeError: storeError?.message, store },
      }, { status: 404 });
    }

    console.log('✅ Store found:', store.shop_domain, 'Active:', store.is_active);

    // 4. Verify store belongs to user
    const { data: userProfile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!userProfile || store.user_id !== userProfile.id) {
      return NextResponse.json({
        success: false,
        step: 'authorization',
        error: 'Store does not belong to user',
        details: { 
          storeUserId: store.user_id, 
          currentUserId: userProfile?.id 
        },
      }, { status: 403 });
    }

    console.log('✅ Store authorization verified');

    // 5. Get decrypted access token
    let tokens;
    try {
      tokens = await getDecryptedTokens(storeId);
      console.log('✅ Access token retrieved (length:', tokens.accessToken.length, ')');
    } catch (tokenError) {
      return NextResponse.json({
        success: false,
        step: 'token_retrieval',
        error: 'Failed to get access token',
        details: { tokenError: tokenError instanceof Error ? tokenError.message : String(tokenError) },
      }, { status: 500 });
    }

    // 6. Test Shopify API connection
    let shopifyClient;
    try {
      shopifyClient = new ShopifyClient({
        storeUrl: store.shop_domain,
        accessToken: tokens.accessToken,
      });
      console.log('✅ Shopify client created');
    } catch (clientError) {
      return NextResponse.json({
        success: false,
        step: 'client_creation',
        error: 'Failed to create Shopify client',
        details: { clientError: clientError instanceof Error ? clientError.message : String(clientError) },
      }, { status: 500 });
    }

    // 7. Test fetching products from Shopify
    let productsResponse;
    try {
      console.log('🔄 Fetching products from Shopify...');
      productsResponse = await shopifyClient.getProducts();
      console.log('✅ Shopify API responded');
    } catch (fetchError) {
      return NextResponse.json({
        success: false,
        step: 'shopify_api_call',
        error: 'Failed to fetch products from Shopify',
        details: { 
          fetchError: fetchError instanceof Error ? fetchError.message : String(fetchError),
          shopDomain: store.shop_domain,
        },
      }, { status: 500 });
    }

    if (!productsResponse.success) {
      return NextResponse.json({
        success: false,
        step: 'shopify_api_response',
        error: 'Shopify API returned error',
        details: { 
          error: productsResponse.error,
          shopDomain: store.shop_domain,
        },
      }, { status: 500 });
    }

    const products = productsResponse.data || [];
    console.log('✅ Products fetched from Shopify:', products.length);

    // 8. Check if products exist in database
    const { data: existingProducts, error: dbError } = await supabase
      .from('products')
      .select('id, shopify_id, title')
      .eq('store_id', storeId)
      .limit(10);

    console.log('✅ Existing products in database:', existingProducts?.length || 0);

    // 9. Return comprehensive diagnostic info
    return NextResponse.json({
      success: true,
      diagnostic: {
        authentication: '✅ Verified',
        store: {
          id: store.id,
          domain: store.shop_domain,
          active: store.is_active,
        },
        token: '✅ Retrieved (length: ' + tokens.accessToken.length + ')',
        shopifyConnection: '✅ Connected',
        productsInShopify: products.length,
        productsInDatabase: existingProducts?.length || 0,
        sampleShopifyProducts: products.slice(0, 3).map(p => ({
          shopifyId: p.id,
          title: p.title,
          variants: p.variants.length,
        })),
      },
      recommendation: products.length === 0 
        ? 'No products found in Shopify store. Make sure your store has products.'
        : 'Sync should work. Click the Sync button to import products.',
    });

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    
    return NextResponse.json({
      success: false,
      step: 'unknown',
      error: 'Unexpected error',
      details: { 
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    }, { status: 500 });
  }
}

