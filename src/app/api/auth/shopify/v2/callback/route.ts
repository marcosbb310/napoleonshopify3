import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createRouteHandlerClient } from '@/shared/lib/supabase';
import { validateSession, completeSession } from '@/features/shopify-oauth/services/sessionService';
import { encryptAndStoreTokens } from '@/features/shopify-oauth/services/tokenService';
import type { OAuthCallbackParams, ShopifyTokenResponse } from '@/features/shopify-oauth/types';

/**
 * GET /api/auth/shopify/v2/callback
 * 
 * Handles OAuth callback from Shopify
 * 
 * Query params:
 * - code: Authorization code
 * - state: CSRF token
 * - shop: Shop domain
 * - hmac: HMAC signature
 * - timestamp: Request timestamp
 */
export async function GET(request: NextRequest) {
  try {
    // Step 1: Extract query parameters
    const { searchParams } = new URL(request.url);
    
    const params: OAuthCallbackParams = {
      code: searchParams.get('code') || '',
      state: searchParams.get('state') || '',
      shop: searchParams.get('shop') || '',
      hmac: searchParams.get('hmac') || '',
      timestamp: searchParams.get('timestamp') || undefined,
      host: searchParams.get('host') || undefined,
    };

    // Step 2: Check for OAuth errors from Shopify
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    if (error) {
      console.error('❌ Shopify OAuth Error:', error, errorDescription);
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'OAuth denied: ${error}${errorDescription ? ' - ' + errorDescription : ''}' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 3: Validate required parameters
    if (!params.code || !params.state || !params.shop || !params.hmac) {
      console.error('❌ Missing OAuth parameters:', params);
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Missing required OAuth parameters' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 4: Validate OAuth session
    const session = await validateSession(params.state);
    
    if (!session) {
      console.error('❌ Invalid or expired OAuth session:', params.state);
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Invalid or expired OAuth session. Please try again.' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 5: Verify HMAC signature
    const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
    
    if (!SHOPIFY_API_SECRET) {
      console.error('❌ Missing SHOPIFY_API_SECRET');
      await completeSession(session.id, false, 'Server configuration error');
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Server configuration error' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Build message for HMAC verification (exclude hmac and signature)
    const message = Array.from(searchParams.entries())
      .filter(([key]) => key !== 'hmac' && key !== 'signature')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    // Calculate expected HMAC
    const expectedHmac = crypto
      .createHmac('sha256', SHOPIFY_API_SECRET)
      .update(message)
      .digest('hex');

    // Timing-safe comparison
    const hmacValid = crypto.timingSafeEqual(
      Buffer.from(expectedHmac),
      Buffer.from(params.hmac)
    );

    if (!hmacValid) {
      console.error('❌ HMAC verification failed');
      await completeSession(session.id, false, 'HMAC verification failed');
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Security verification failed. Please try again.' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 6: Exchange authorization code for access token
    const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
    const shopDomain = params.shop.includes('.myshopify.com') 
      ? params.shop 
      : `${params.shop}.myshopify.com`;

    const tokenResponse = await fetch(
      `https://${shopDomain}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: SHOPIFY_API_KEY,
          client_secret: SHOPIFY_API_SECRET,
          code: params.code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed:', tokenResponse.status);
      await completeSession(session.id, false, 'Token exchange failed');
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Failed to exchange authorization code for access token' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const tokenData = await tokenResponse.json() as ShopifyTokenResponse;

    if (!tokenData.access_token) {
      console.error('❌ No access token in response');
      await completeSession(session.id, false, 'No access token received');
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'No access token received from Shopify' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 7: Encrypt and store tokens
    const storeId = await encryptAndStoreTokens(
      session.userId,
      shopDomain,
      {
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
      }
    );

    // Step 8: Register webhooks (non-blocking)
    registerWebhooksAsync(storeId, shopDomain, tokenData.access_token).catch(err => {
      console.error('Webhook registration failed (non-critical):', err);
    });

    // Step 9: Trigger product sync (non-blocking)
    triggerProductSyncAsync(storeId, shopDomain, tokenData.access_token).catch(err => {
      console.error('Product sync failed (non-critical):', err);
    });

    // Step 10: Mark session as completed
    await completeSession(session.id, true);

    console.log('✅ OAuth completed successfully:', {
      shopDomain,
      storeId,
      sessionId: session.id,
    });

    // Step 11: Close window and notify parent
    return new NextResponse(
      `<html><body><script>
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'OAUTH_SUCCESS',
            storeId: '${storeId}',
            shopDomain: '${shopDomain}'
          }, window.location.origin);
        }
        window.close();
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    
    return new NextResponse(
      `<html><body><script>
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'OAUTH_ERROR', 
            error: 'OAuth callback failed: ${error instanceof Error ? error.message : 'Unknown error'}' 
          }, window.location.origin);
        }
        window.close();
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Register webhooks asynchronously (non-blocking)
 */
async function registerWebhooksAsync(
  storeId: string,
  shopDomain: string,
  accessToken: string
): Promise<void> {
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/product-update`;
  const baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;
  
  // Check for existing webhooks
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
  
  // Check if webhook already exists
  const existingWebhook = webhooks?.find((w: Record<string, unknown>) => 
    w.topic === 'products/update' && w.address === webhookUrl
  );
  
  if (existingWebhook) {
    console.log('Webhook already registered:', existingWebhook.id);
    return;
  }
  
  // Register new webhook
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

/**
 * Trigger product sync asynchronously (non-blocking)
 */
async function triggerProductSyncAsync(
  storeId: string,
  shopDomain: string,
  accessToken: string
): Promise<void> {
  try {
    // Import sync service (if it exists)
    const { syncProductsFromShopify } = await import(
      '@/features/shopify-integration/services/syncProducts'
    );
    
    // Trigger sync (don't await)
    syncProductsFromShopify(storeId, shopDomain, accessToken).catch(err => {
      console.error('Product sync error:', err);
    });
  } catch (error) {
    // Sync service doesn't exist yet, that's okay
    console.log('Product sync service not available yet, skipping sync');
  }
}
