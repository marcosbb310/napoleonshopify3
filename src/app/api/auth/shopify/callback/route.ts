import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient, createRouteHandlerClient } from '@/shared/lib/supabase'

async function registerWebhooks(shopDomain: string, accessToken: string) {
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/product-update`;
  const baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;
  
  // Step 1: Check for existing webhooks
  const existingResponse = await fetch(`${baseUrl}/webhooks.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });
  
  if (!existingResponse.ok) {
    throw new Error(`Failed to fetch existing webhooks: ${existingResponse.status}`);
  }
  
  const { webhooks } = await existingResponse.json();
  
  // Step 2: Check if webhook already exists
  const existingWebhook = webhooks?.find((w: any) => 
    w.topic === 'products/update' && w.address === webhookUrl
  );
  
  if (existingWebhook) {
    console.log('Webhook already registered:', existingWebhook.id);
    return; // Skip registration
  }
  
  // Step 3: Register new webhook
  const registerResponse = await fetch(`${baseUrl}/webhooks.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
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
    const error = await registerResponse.json();
    throw new Error(`Failed to register webhook: ${JSON.stringify(error)}`);
  }
  
  const { webhook } = await registerResponse.json();
  console.log('Webhook registered successfully:', webhook.id);
}

async function triggerProductSync(storeId: string, shopDomain: string, accessToken: string) {
  // Update sync status to in_progress
  const supabaseAdmin = createAdminClient();
  await supabaseAdmin
    .from('sync_status')
    .upsert({
      store_id: storeId,
      status: 'in_progress',
      products_synced: 0,
      total_products: 0,
      started_at: new Date().toISOString(),
    });

  // Call sync service directly (not HTTP request to avoid auth issues)
  const { syncProductsFromShopify } = await import('@/features/shopify-integration/services/syncProducts');
  
  try {
    const result = await syncProductsFromShopify(storeId, shopDomain, accessToken);
    
    // Update sync status
    await supabaseAdmin
      .from('sync_status')
      .update({
        status: result.success ? 'completed' : 'failed',
        products_synced: result.synced,
        completed_at: new Date().toISOString(),
        error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
      })
      .eq('store_id', storeId);
      
  } catch (error) {
    // Update sync status to failed
    await supabaseAdmin
      .from('sync_status')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('store_id', storeId);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = createRouteHandlerClient(request)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.redirect(new URL('/?error=Please sign in first to connect a Shopify store', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const hmac = searchParams.get('hmac')
    const shop = searchParams.get('shop')
    
    const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY
    const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !ENCRYPTION_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Validate required parameters
    if (!code || !shop) {
      return NextResponse.json(
        { error: 'Missing required OAuth parameters' },
        { status: 400 }
      )
    }

    // Verify HMAC signature
    if (hmac) {
      const params = Object.fromEntries(searchParams.entries())
      delete params.hmac
      
      const message = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&')
      
      const generatedHmac = crypto
        .createHmac('sha256', SHOPIFY_API_SECRET)
        .update(message)
        .digest('hex')

      if (generatedHmac !== hmac) {
        return NextResponse.json({ error: 'Invalid HMAC' }, { status: 403 })
      }
    }

    const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to exchange code for access token' },
        { status: 400 }
      )
    }

    const { access_token, scope } = await tokenResponse.json()

    if (!access_token) {
      return NextResponse.json({ error: 'No access token received' }, { status: 400 })
    }

    // Get user's profile from public.users table
    const supabaseAdmin = createAdminClient()
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Encrypt the access token
    const { data: encryptedToken } = await supabaseAdmin.rpc('encrypt_token', {
      token_text: access_token,
      key: ENCRYPTION_KEY,
    })

    if (!encryptedToken) {
      return NextResponse.json({ error: 'Failed to encrypt token' }, { status: 500 })
    }

    // Check if store already exists for this user
    const { data: existingStore } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('shop_domain', shopDomain)
      .eq('user_id', userProfile.id)
      .single()

    let storeId: string;
    if (existingStore) {
      // Update existing store
      await supabaseAdmin
        .from('stores')
        .update({
          access_token_encrypted: encryptedToken,
          scope,
          last_synced_at: new Date().toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingStore.id)
      storeId = existingStore.id;
    } else {
      // Create new store
      const { data: newStore } = await supabaseAdmin
        .from('stores')
        .insert({
          user_id: userProfile.id,
          shop_domain: shopDomain,
          access_token_encrypted: encryptedToken,
          scope,
          installed_at: new Date().toISOString(),
          is_active: true,
        })
        .select('id')
        .single()
      storeId = newStore!.id;
    }

    // Register product update webhook (with duplicate check and error handling)
    try {
      await registerWebhooks(shopDomain, access_token);
    } catch (error) {
      console.error('Webhook registration failed:', error);
      // Don't fail OAuth - webhook can be registered manually
    }

    // Trigger automatic product sync in background
    try {
      await triggerProductSync(storeId, shopDomain, access_token);
    } catch (error) {
      console.error('Auto-sync failed:', error);
      // Don't fail OAuth - user can sync manually
    }

    // Close the popup window
    return new NextResponse(
      `<html><body><script>window.close()</script></body></html>`,
      {
        headers: { 'Content-Type': 'text/html' },
      }
    )

  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.json(
      { error: 'OAuth callback failed' },
      { status: 500 }
    )
  }
}
