import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';
import crypto from 'crypto';
import { normalizeShopifyId } from '@/shared/utils/shopifyIdNormalizer';

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
// Handle GET requests (for webhook testing)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Webhook endpoint is active and ready to receive product updates',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    // MANDATORY webhook verification
    const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      logger.error('SHOPIFY_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Server misconfigured' }, 
        { status: 500 }
      );
    }

    const hmac = request.headers.get('x-shopify-hmac-sha256');
    const hash = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body, 'utf8')
      .digest('base64');

    if (hash !== hmac) {
      logger.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' }, 
        { status: 401 }
      );
    }

    // Parse product data
    const product = JSON.parse(body);
    const webhookId = request.headers.get('x-shopify-webhook-id');
    
    // Validate and normalize product ID
    const normalizedProductId = normalizeShopifyId(product.id);
    if (!normalizedProductId) {
      logger.error('Webhook rejected product with invalid ID', { 
        webhookId,
        productTitle: product.title,
        rawId: product.id,
      });
      return NextResponse.json(
        { error: 'Invalid product ID' }, 
        { status: 400 }
      );
    }
    
    logger.info(`Product update webhook received: ${product.title} (ID: ${normalizedProductId})`, {
      webhookId,
    });

    // Extract new price from first variant
    if (!product.variants || product.variants.length === 0) {
      logger.warn('No variants found in product', { webhookId });
      return NextResponse.json({ warning: 'No variants found' });
    }

    const newPrice = parseFloat(product.variants[0].price);
    logger.info(`New price detected: $${newPrice}`, { webhookId });

    // Calculate next price change date (today + 2 days)
    const nextPriceChangeDate = new Date();
    nextPriceChangeDate.setDate(nextPriceChangeDate.getDate() + 2);

    // Initialize Supabase admin client
    const supabaseAdmin = createAdminClient();

    // Check if webhook already processed (idempotency)
    const storeDomain = request.headers.get('x-shopify-shop-domain');

    if (!webhookId || !storeDomain) {
      return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 });
    }

    // Get store ID from domain
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('shop_domain', storeDomain)
      .single();

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Check if webhook already processed
    const { data: existingWebhook } = await supabaseAdmin
      .from('processed_webhooks')
      .select('id')
      .eq('webhook_id', webhookId)
      .eq('store_id', store.id)
      .single();

    if (existingWebhook) {
      logger.info(`Webhook ${webhookId} already processed, skipping`, { webhookId, storeId: store.id });
      return NextResponse.json({ message: 'Already processed' });
    }

    // Mark webhook as processed
    await supabaseAdmin
      .from('processed_webhooks')
      .insert({
        webhook_id: webhookId,
        store_id: store.id,
        topic: 'products/update',
        payload_hash: crypto.createHash('sha256').update(body).digest('hex'),
      });

    // Update pricing_config in database using normalized ID
    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .update({
        current_price: newPrice,
        last_price_change_date: new Date().toISOString(),
        next_price_change_date: nextPriceChangeDate.toISOString(),
      })
      .eq('shopify_product_id', normalizedProductId)
      .select();

    if (error) {
      logger.error('Database update failed', error as Error, { webhookId, storeId: store.id });
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      logger.warn(`No pricing config found for product ${normalizedProductId}`, { webhookId, storeId: store.id });
      return NextResponse.json({ 
        warning: 'Product not in smart pricing system' 
      });
    }

    logger.info(`Pricing cycle reset for product ${normalizedProductId}`, { webhookId, storeId: store.id });
    logger.info(`Next price change: ${nextPriceChangeDate.toISOString()}`, { webhookId, storeId: store.id });

    return NextResponse.json({
      success: true,
      productId: normalizedProductId,
      newPrice,
      nextPriceChangeDate: nextPriceChangeDate.toISOString(),
    });

  } catch (error) {
    logger.error('Webhook processing error', error as Error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

