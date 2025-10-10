// API endpoint to sync orders from Shopify to Supabase
import { NextResponse } from 'next/server';
import { syncOrdersFromShopify } from '@/features/shopify-integration/services/syncOrders';

export async function POST() {
  try {
    // Sync last 90 days of orders
    const result = await syncOrdersFromShopify(90);

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

