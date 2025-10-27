import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const { action } = await request.json();

    if (action === 'reregister_webhooks') {
      // Re-register webhooks
      const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/product-update`;
      const baseUrl = `https://${store.shop_domain}/admin/api/${apiVersion}`;

      // Delete existing webhooks
      const existingResponse = await fetch(`${baseUrl}/webhooks.json`, {
        headers: {
          'X-Shopify-Access-Token': store.access_token,
          'Content-Type': 'application/json',
        },
      });

      if (existingResponse.ok) {
        const { webhooks } = await existingResponse.json();
        const productUpdateWebhooks = webhooks.filter(
          (w: Record<string, unknown>) => w.topic === 'products/update' && w.address === webhookUrl
        );

        // Delete existing webhooks
        for (const webhook of productUpdateWebhooks) {
          await fetch(`${baseUrl}/webhooks/${webhook.id}.json`, {
            method: 'DELETE',
            headers: {
              'X-Shopify-Access-Token': store.access_token,
            },
          });
        }
      }

      // Register new webhook
      const registerResponse = await fetch(`${baseUrl}/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': store.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook: {
            topic: 'products/update',
            address: webhookUrl,
            format: 'json',
          },
        }),
      });

      if (!registerResponse.ok) {
        throw new Error('Failed to register webhook');
      }

      logger.info('Webhooks re-registered successfully', { storeId: store.id });

      return NextResponse.json({
        success: true,
        message: 'Webhooks re-registered successfully',
      });
    }

    if (action === 'retry_sync') {
      // Retry product sync
      const supabaseAdmin = createAdminClient();
      
      // Clear any failed sync status
      await supabaseAdmin
        .from('sync_status')
        .delete()
        .eq('store_id', store.id);

      // Trigger new sync
      const { syncProductsFromShopify } = await import('@/features/shopify-integration/services/syncProducts');
      
      const result = await syncProductsFromShopify(
        store.id,
        store.shop_domain,
        store.access_token
      );

      logger.info('Product sync retried', { 
        storeId: store.id, 
        success: result.success,
        synced: result.synced 
      });

      return NextResponse.json({
        success: result.success,
        message: result.success 
          ? `Synced ${result.synced} products` 
          : 'Sync failed',
        errors: result.errors,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    logger.error('Store reconnect failed', error as Error);
    return NextResponse.json(
      { success: false, error: 'Reconnect failed' },
      { status: 500 }
    );
  }
}
