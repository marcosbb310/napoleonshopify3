import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/shared/lib/supabase';
import crypto from 'crypto';

/**
 * Shopify Product Update Webhook Handler
 * 
 * This endpoint receives notifications from Shopify when a product is manually updated.
 * It detects price changes and resets the smart pricing cycle for that product.
 * 
 * Flow:
 * 1. Verify webhook authenticity using HMAC signature
 * 2. Extract new price from product data
 * 3. Update pricing_config with new price
 * 4. Reset next_price_change_date to today + 2 days
 * 
 * This ensures manual price changes are respected and the algorithm
 * waits 2 days before resuming optimization for that product.
 */
export async function POST(request: NextRequest) {
  try {
    // Get webhook signature from headers
    const hmac = request.headers.get('x-shopify-hmac-sha256');
    const body = await request.text();
    
    // Verify webhook authenticity
    if (process.env.SHOPIFY_WEBHOOK_SECRET) {
      const hash = crypto
        .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
        .update(body, 'utf8')
        .digest('base64');
      
      if (hash !== hmac) {
        console.error('❌ Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid webhook signature' }, 
          { status: 401 }
        );
      }
    }

    // Parse product data
    const product = JSON.parse(body);
    console.log(`📦 Product update webhook received: ${product.title} (ID: ${product.id})`);

    // Extract new price from first variant
    if (!product.variants || product.variants.length === 0) {
      console.warn('⚠️ No variants found in product');
      return NextResponse.json({ warning: 'No variants found' });
    }

    const newPrice = parseFloat(product.variants[0].price);
    console.log(`💰 New price detected: $${newPrice}`);

    // Calculate next price change date (today + 2 days)
    const nextPriceChangeDate = new Date();
    nextPriceChangeDate.setDate(nextPriceChangeDate.getDate() + 2);

    // Update pricing_config in database
    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .update({
        current_price: newPrice,
        last_price_change_date: new Date().toISOString(),
        next_price_change_date: nextPriceChangeDate.toISOString(),
      })
      .eq('shopify_product_id', product.id.toString())
      .select();

    if (error) {
      console.error('❌ Database update failed:', error);
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.warn(`⚠️ No pricing config found for product ${product.id}`);
      return NextResponse.json({ 
        warning: 'Product not in smart pricing system' 
      });
    }

    console.log(`✅ Pricing cycle reset for product ${product.id}`);
    console.log(`📅 Next price change: ${nextPriceChangeDate.toISOString()}`);

    return NextResponse.json({
      success: true,
      productId: product.id,
      newPrice,
      nextPriceChangeDate: nextPriceChangeDate.toISOString(),
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

