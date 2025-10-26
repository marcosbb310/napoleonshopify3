import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/shared/lib/supabase';
import { processSalesData } from '@/features/analytics-dashboard/services/salesProcessor';

export async function POST(request: NextRequest) {
  try {
    // Verify HMAC
    const hmac = request.headers.get('x-shopify-hmac-sha256');
    const shopDomain = request.headers.get('x-shopify-shop-domain');
    
    if (!hmac || !shopDomain) {
      return NextResponse.json({ error: 'Missing headers' }, { status: 400 });
    }
    
    const body = await request.text();
    const secret = process.env.SHOPIFY_API_SECRET!;
    
    const calculatedHmac = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('base64');
    
    if (hmac !== calculatedHmac) {
      return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
    }
    
    const orderData = JSON.parse(body);
    
    // Get store_id from shop_domain
    const supabase = createAdminClient();
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('shop_domain', shopDomain)
      .single();
    
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    
    // Log webhook receipt
    const { data: logEntry } = await supabase
      .from('webhook_logs')
      .insert({
        store_id: store.id,
        topic: 'orders/create',
        payload: orderData,
        processed: false,
        received_at: new Date().toISOString()
      })
      .select()
      .single();
    
    // Process sales data
    try {
      await processSalesData(orderData, store.id);
      
      // Mark as processed
      await supabase
        .from('webhook_logs')
        .update({
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', logEntry.id);
      
      return NextResponse.json({ success: true });
    } catch (error) {
      // Mark as failed
      await supabase
        .from('webhook_logs')
        .update({
          processed: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          processed_at: new Date().toISOString()
        })
        .eq('id', logEntry.id);
      
      throw error;
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}
