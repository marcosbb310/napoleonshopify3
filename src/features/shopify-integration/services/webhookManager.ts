import { createAdminClient } from '@/shared/lib/supabase';

interface WebhookTopic {
  topic: string;
  endpoint: string;
}

const WEBHOOK_TOPICS: WebhookTopic[] = [
  { topic: 'orders/create', endpoint: '/api/webhooks/shopify/orders-create' },
  { topic: 'products/update', endpoint: '/api/webhooks/shopify/products-update' }
];

export async function registerAllWebhooks(
  storeId: string,
  shopDomain: string,
  accessToken: string
): Promise<{ success: boolean; registered: string[]; errors: string[] }> {
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
  const baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  const registered: string[] = [];
  const errors: string[] = [];
  
  // Get existing webhooks
  const existingResponse = await fetch(`${baseUrl}/webhooks.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });
  
  if (!existingResponse.ok) {
    return { success: false, registered: [], errors: ['Failed to fetch existing webhooks'] };
  }
  
  const { webhooks: existingWebhooks } = await existingResponse.json();
  
  // Register each webhook
  for (const { topic, endpoint } of WEBHOOK_TOPICS) {
    const webhookUrl = `${appUrl}${endpoint}`;
    
    // Check if already registered
    const exists = existingWebhooks?.find((w: any) => 
      w.topic === topic && w.address === webhookUrl
    );
    
    if (exists) {
      registered.push(topic);
      continue;
    }
    
    // Register new webhook
    try {
      const response = await fetch(`${baseUrl}/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: webhookUrl,
            format: 'json'
          }
        })
      });
      
      if (response.ok) {
        const { webhook } = await response.json();
        registered.push(topic);
        
        // Log to database
        const supabase = createAdminClient();
        await supabase
          .from('webhook_logs')
          .insert({
            store_id: storeId,
            topic,
            shopify_webhook_id: webhook.id,
            payload: { action: 'registered', webhook_id: webhook.id },
            processed: true,
            processed_at: new Date().toISOString()
          });
      } else {
        const error = await response.json();
        errors.push(`${topic}: ${JSON.stringify(error)}`);
      }
    } catch (error) {
      errors.push(`${topic}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return {
    success: errors.length === 0,
    registered,
    errors
  };
}

export async function verifyWebhookRegistration(storeId: string): Promise<boolean> {
  const supabase = createAdminClient();
  
  // Get store credentials
  const { data: store } = await supabase
    .from('stores')
    .select('shop_domain, encrypted_access_token')
    .eq('id', storeId)
    .single();
  
  if (!store) return false;
  
  // Decrypt token and check webhooks
  const { getDecryptedTokens } = await import('@/features/shopify-oauth/services/tokenService');
  const tokens = await getDecryptedTokens(storeId);
  
  if (!tokens) return false;
  
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
  const response = await fetch(
    `https://${store.shop_domain}/admin/api/${apiVersion}/webhooks.json`,
    {
      headers: {
        'X-Shopify-Access-Token': tokens.accessToken,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) return false;
  
  const { webhooks } = await response.json();
  return webhooks && webhooks.length >= WEBHOOK_TOPICS.length;
}
