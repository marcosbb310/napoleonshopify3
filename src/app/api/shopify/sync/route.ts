// API endpoint to sync products from Shopify to Supabase
import { NextResponse } from 'next/server';
import { syncProductsFromShopify } from '@/features/shopify-integration/services/syncProducts';

export async function POST() {
  try {
    const result = await syncProductsFromShopify();

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

