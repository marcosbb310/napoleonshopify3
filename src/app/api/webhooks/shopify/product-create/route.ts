import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';
import crypto from 'crypto';
import { normalizeShopifyId } from '@/shared/utils/shopifyIdNormalizer';

/**
 * Shopify Product Create Webhook Handler
 * 
 * This endpoint receives notifications from Shopify when a product is created.
 * It automatically syncs the new product to our database.
 * 
 * Flow:
 * 1. Verify webhook authenticity using HMAC signature
 * 2. Validate and normalize product ID
 * 3. Insert product into products table
 * 4. Process variants if present
 */
// Handle GET requests (for webhook testing)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Webhook endpoint is active and ready to receive product creation events',
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

    logger.info(`Product create webhook received: ${product.title} (ID: ${normalizedProductId})`, {
      webhookId,
    });

    const storeDomain = request.headers.get('x-shopify-shop-domain');
    if (!webhookId || !storeDomain) {
      return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    
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
        topic: 'products/create',
        payload_hash: crypto.createHash('sha256').update(body).digest('hex'),
      });

    // Insert product with validated, normalized ID
    const { data: insertedProduct, error: insertError } = await supabaseAdmin
      .from('products')
      .upsert({
        store_id: store.id,
        shopify_id: normalizedProductId,  // ✅ Validated and normalized
        title: product.title,
        handle: product.handle,
        vendor: product.vendor || null,
        product_type: product.product_type || null,
        tags: product.tags ? product.tags.split(',').map((tag: string) => tag.trim()) : [],
        status: product.status,
        created_at: product.created_at,
        updated_at: product.updated_at,
        is_active: true,
      }, {
        onConflict: 'store_id,shopify_id',
      })
      .select('id')
      .single();

    if (insertError) {
      logger.error('Failed to create product from webhook', insertError, { webhookId, storeId: store.id });
      return NextResponse.json(
        { error: insertError.message }, 
        { status: 500 }
      );
    }

    logger.info(`Product created successfully: ${normalizedProductId}`, { 
      webhookId, 
      storeId: store.id,
      dbId: insertedProduct.id,
    });

    return NextResponse.json({
      success: true,
      productId: normalizedProductId,
      dbId: insertedProduct.id,
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

