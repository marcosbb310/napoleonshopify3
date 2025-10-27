import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';
import { createHmac } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/product-update`;
    const baseUrl = `https://${store.shop_domain}/admin/api/${apiVersion}`;

    // Check registered webhooks in Shopify
    const webhooksResponse = await fetch(`${baseUrl}/webhooks.json`, {
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json',
      },
    });

    let registeredWebhooks = [];
    if (webhooksResponse.ok) {
      const data = await webhooksResponse.json();
      registeredWebhooks = data.webhooks || [];
    }

    // Check sync status
    const supabaseAdmin = createAdminClient();
    const { data: syncStatus } = await supabaseAdmin
      .from('sync_status')
      .select('*')
      .eq('store_id', store.id)
      .single();

    // Check recent webhook processing
    const { data: recentWebhooks } = await supabaseAdmin
      .from('processed_webhooks')
      .select('*')
      .eq('store_id', store.id)
      .order('processed_at', { ascending: false })
      .limit(10);

    const productUpdateWebhook = registeredWebhooks.find(
      (w: Record<string, unknown>) => w.topic === 'products/update' && w.address === webhookUrl
    );

    return NextResponse.json({
      success: true,
      store: {
        id: store.id,
        domain: store.shop_domain,
        isActive: store.is_active,
      },
      webhook: {
        url: webhookUrl,
        secret: !!process.env.SHOPIFY_WEBHOOK_SECRET,
        registered: !!productUpdateWebhook,
        webhookId: productUpdateWebhook?.id,
        createdAt: productUpdateWebhook?.created_at,
      },
      sync: {
        status: syncStatus?.status || 'never_synced',
        productsSynced: syncStatus?.products_synced || 0,
        lastSync: syncStatus?.completed_at,
        error: syncStatus?.error_message,
      },
      recentWebhooks: recentWebhooks || [],
    });

  } catch (error) {
    logger.error('Webhook test endpoint failed', error as Error);
    return NextResponse.json(
      { success: false, error: 'Test failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const { action } = await request.json();

    if (action === 'test_webhook') {
      // Send test webhook to our endpoint
      const testPayload = {
        id: 999999,
        title: 'Test Webhook Product',
        variants: [{ id: 888888, price: '99.99' }],
      };

      const hmac = createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
        .update(JSON.stringify(testPayload), 'utf8')
        .digest('base64');

      const testResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/product-update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Hmac-Sha256': hmac,
            'X-Shopify-Webhook-Id': 'test-webhook-123',
            'X-Shopify-Shop-Domain': store.shop_domain,
          },
          body: JSON.stringify(testPayload),
        }
      );

      return NextResponse.json({
        success: true,
        testResult: {
          status: testResponse.status,
          ok: testResponse.ok,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    logger.error('Webhook test action failed', error as Error);
    return NextResponse.json(
      { success: false, error: 'Test action failed' },
      { status: 500 }
    );
  }
}
