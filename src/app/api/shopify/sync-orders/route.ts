// API endpoint to sync orders from Shopify to Supabase
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { syncOrdersFromShopify } from '@/features/shopify-integration/services/syncOrders';

export async function POST(request: NextRequest) {
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    // Sync last 90 days of orders
    const result = await syncOrdersFromShopify(store.id, store.shop_domain, store.access_token, 90);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Sync completed with errors',
          ordersProcessed: result.ordersProcessed,
          salesRecordsCreated: result.salesRecordsCreated,
          errors: result.errors,
        },
        { status: 207 } // Multi-status
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.ordersProcessed} orders into ${result.salesRecordsCreated} sales records`,
      ordersProcessed: result.ordersProcessed,
      salesRecordsCreated: result.salesRecordsCreated,
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

