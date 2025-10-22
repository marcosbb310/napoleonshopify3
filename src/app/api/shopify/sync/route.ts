// API endpoint to sync products from Shopify to Supabase
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { syncProductsFromShopify } from '@/features/shopify-integration/services/syncProducts';

export async function POST(request: NextRequest) {
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const result = await syncProductsFromShopify(store.id, store.shop_domain, store.access_token);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Sync completed with errors',
          synced: result.synced,
          errors: result.errors,
        },
        { status: 207 } // Multi-status
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.synced} products`,
      synced: result.synced,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        message: 'Sync failed',
        error: message,
      },
      { status: 500 }
    );
  }
}

