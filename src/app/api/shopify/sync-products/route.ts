import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { getDecryptedTokens } from '@/features/shopify-oauth/services/tokenService';
import { syncProductsFromShopify } from '@/features/shopify-integration/services/syncProducts';

export async function POST(request: NextRequest) {
  try {
    // Require authenticated store
    const { user, store, error: authError } = await requireStore(request);
    if (authError) return authError;

    // Get decrypted access token
    const tokens = await getDecryptedTokens(store.id);
    if (!tokens) {
      return NextResponse.json(
        { success: false, error: 'Store credentials not found' },
        { status: 404 }
      );
    }

    // Sync products
    const result = await syncProductsFromShopify(
      store.id,
      store.shop_domain,
      tokens.accessToken
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
