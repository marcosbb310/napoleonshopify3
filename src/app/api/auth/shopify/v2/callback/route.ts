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

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // CRITICAL: Log immediately using multiple methods to ensure visibility
  const logMsg = `🔵🔵🔵 OAuth callback route EXECUTING - URL: ${request.url}\n`;
  console.log(logMsg);
  process.stdout.write(logMsg); // Also write directly to stdout
  console.error(logMsg); // Also write to stderr
  
  try {
    // Step 1: Extract query parameters
    const { searchParams } = new URL(request.url);
    console.log('🔵 Callback params:', {
      code: searchParams.get('code') ? 'present' : 'missing',
      state: searchParams.get('state') ? 'present' : 'missing',
      shop: searchParams.get('shop'),
      error: searchParams.get('error'),
    });
    
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
        `<!DOCTYPE html>
<html><head><title>OAuth Error</title></head>
<body style="font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #fee; color: #c33;">
  <h2>❌ OAuth Error</h2>
  <p><strong>${error}</strong></p>
  ${errorDescription ? `<p>${errorDescription}</p>` : ''}
  <button onclick="window.location.href='/dashboard'" style="padding: 10px 20px; margin-top: 20px; cursor: pointer;">Go to Dashboard</button>
  <script>
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ 
        type: 'OAUTH_ERROR', 
        error: 'OAuth denied: ${error}${errorDescription ? ' - ' + errorDescription : ''}' 
      }, window.location.origin);
      setTimeout(() => { try { window.close(); } catch(e) {} }, 2000);
    }
  </script>
</body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
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

    console.log('🔵 Exchanging code for token:', { shopDomain, hasCode: !!params.code });
    
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

    console.log('🔵 Token exchange response:', { status: tokenResponse.status, ok: tokenResponse.ok });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', tokenResponse.status, errorText);
      await completeSession(session.id, false, 'Token exchange failed');
      return new NextResponse(
        `<html><head><title>OAuth Error</title></head><body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>❌ Token Exchange Failed</h2>
          <p>Status: ${tokenResponse.status}</p>
          <p>Please try again.</p>
          <script>
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ 
                type: 'OAUTH_ERROR', 
                error: 'Failed to exchange authorization code for access token' 
              }, window.location.origin);
              setTimeout(() => window.close(), 2000);
            } else {
              setTimeout(() => window.location.href = '/dashboard', 2000);
            }
          </script>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const tokenData = await tokenResponse.json() as ShopifyTokenResponse;
    console.log('🔵 Token data received:', { hasToken: !!tokenData.access_token, hasScope: !!tokenData.scope });

    if (!tokenData.access_token) {
      console.error('❌ No access token in response:', tokenData);
      await completeSession(session.id, false, 'No access token received');
      return new NextResponse(
        `<html><head><title>OAuth Error</title></head><body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>❌ No Access Token Received</h2>
          <p>Shopify did not return an access token.</p>
          <script>
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ 
                type: 'OAUTH_ERROR', 
                error: 'No access token received from Shopify' 
              }, window.location.origin);
              setTimeout(() => window.close(), 2000);
            } else {
              setTimeout(() => window.location.href = '/dashboard', 2000);
            }
          </script>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 7: Encrypt and store tokens
    console.log('🔵 Encrypting and storing tokens...');
    let storeId: string;
    try {
      storeId = await encryptAndStoreTokens(
        session.userId,
        shopDomain,
        {
          accessToken: tokenData.access_token,
          scope: tokenData.scope,
        }
      );
      console.log('🔵 Store ID created:', storeId);
    } catch (error) {
      console.error('❌ Failed to encrypt and store tokens:', error);
      await completeSession(session.id, false, error instanceof Error ? error.message : 'Failed to store tokens');
      return new NextResponse(
        `<html><head><title>OAuth Error</title></head><body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>❌ Failed to Store Tokens</h2>
          <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <script>
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ 
                type: 'OAUTH_ERROR', 
                error: 'Failed to store tokens: ${error instanceof Error ? error.message.replace(/'/g, "\\'") : 'Unknown error'}' 
              }, window.location.origin);
              setTimeout(() => window.close(), 3000);
            } else {
              setTimeout(() => window.location.href = '/dashboard', 3000);
            }
          </script>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 8: Register webhooks (non-blocking) - don't await, run in background
    registerWebhooksAsync(storeId, shopDomain, tokenData.access_token).catch(err => {
      console.error('Webhook registration failed (non-critical):', err);
    });

    // Step 9: Trigger product sync (non-blocking) - don't await, run in background
    triggerProductSyncAsync(storeId, shopDomain, tokenData.access_token).catch(err => {
      console.error('Product sync failed (non-critical):', err);
    });

    // Step 10: Mark session as completed (wrap in try-catch to not block success response)
    try {
      await completeSession(session.id, true);
      console.log('✅ Session marked as completed');
    } catch (sessionError) {
      console.error('⚠️ Failed to mark session as completed (non-critical):', sessionError);
      // Don't throw - this is non-critical
    }

    console.log('✅ OAuth completed successfully:', {
      shopDomain,
      storeId,
      sessionId: session.id,
    });

    // Step 11: Close window and notify parent
    console.log('🔵 Returning success HTML response');
    console.log('🔵 Success details:', { storeId, shopDomain, sessionId: session.id });
    
    // Ensure storeId and shopDomain are valid strings (no undefined)
    const safeStoreId = String(storeId || 'unknown');
    const safeShopDomain = String(shopDomain || 'unknown');
    
    // Create a simple, guaranteed-to-render HTML first
    const successHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth Success</title>
  <!-- Fallback for no-JS browsers -->
  <noscript>
    <style>
      body { font-family: Arial; padding: 40px; text-align: center; background: #667eea; color: white; }
      h1 { font-size: 24px; margin: 20px 0; }
    </style>
    <h1>✅ Store Connected Successfully!</h1>
    <p>You can close this window.</p>
  </noscript>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      padding: 40px 20px;
      text-align: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 100vh;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      color: #333;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
    }
    h2 {
      color: #22c55e;
      margin: 0 0 20px 0;
      font-size: 28px;
    }
    #status {
      margin: 20px 0;
      font-size: 16px;
      color: #666;
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Visible immediately, no JS required -->
    <h2>✅ Store Connected Successfully!</h2>
    <p><strong>This page is loading correctly!</strong></p>
    <p>Store: ${safeShopDomain}</p>
    <div class="spinner"></div>
    <p id="status">Processing connection...</p>
    <p style="font-size: 12px; color: #999; margin-top: 20px;">
      If this window doesn't close automatically, you can close it manually.
    </p>
    <!-- Fallback button for manual close -->
    <button onclick="window.close()" style="padding: 10px 20px; margin-top: 20px; cursor: pointer; background: #667eea; color: white; border: none; border-radius: 4px;">
      Close Window
    </button>
  </div>
  <script>
    (function() {
      console.log('[OAuth Callback] Script started');
      console.log('[OAuth Callback] Store ID:', '${safeStoreId}');
      console.log('[OAuth Callback] Shop Domain:', '${safeShopDomain}');
      console.log('[OAuth Callback] Has window.opener:', !!window.opener);
      console.log('[OAuth Callback] Opener closed:', window.opener ? window.opener.closed : 'N/A');
      
      const statusEl = document.getElementById('status');
      
      function updateStatus(msg) {
        console.log('[OAuth Callback] Status:', msg);
        if (statusEl) statusEl.textContent = msg;
      }
      
      try {
        updateStatus('Sending success message...');
        
        // Check if we have a window.opener (popup) or need to redirect (same tab)
        if (window.opener && !window.opener.closed) {
          // Popup flow - send message and close
          updateStatus('Sending message to parent window...');
          
          window.opener.postMessage({ 
            type: 'OAUTH_SUCCESS',
            storeId: '${safeStoreId}',
            shopDomain: '${safeShopDomain}'
          }, window.location.origin);
          
          console.log('[OAuth Callback] postMessage sent successfully');
          updateStatus('Closing window...');
          
          // Try to close the popup
          setTimeout(() => {
            try {
              window.close();
              console.log('[OAuth Callback] Window close() called');
              // If close doesn't work, show message
              setTimeout(() => {
                if (!window.closed) {
                  updateStatus('You can close this window now.');
                }
              }, 1000);
            } catch (e) {
              console.warn('[OAuth Callback] Could not close window:', e);
              updateStatus('Please close this window manually.');
            }
          }, 500);
        } else {
          // Same-tab redirect flow - redirect to success page
          console.log('[OAuth Callback] No window.opener, redirecting...');
          updateStatus('Redirecting to dashboard...');
          
          setTimeout(() => {
            window.location.href = '/dashboard?store_connected=true&storeId=${safeStoreId}&shopDomain=${encodeURIComponent(safeShopDomain)}';
          }, 1500);
        }
      } catch (error) {
        console.error('[OAuth Callback] Error in script:', error);
        updateStatus('Error: ' + error.message);
        
        setTimeout(() => {
          window.location.href = '/dashboard?store_connected=true&storeId=${safeStoreId}';
        }, 3000);
      }
    })();
  </script>
</body>
</html>`;
    
    console.log('🔵🔵🔵 Returning success HTML response - Length:', successHtml.length);
    
    const response = new NextResponse(successHtml, { 
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Frame-Options': 'SAMEORIGIN', // Allow popup rendering
      } 
    });
    
    console.log('🔵🔵🔵 Response headers:', Object.fromEntries(response.headers.entries()));
    
    return response;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('❌ OAuth callback error:', {
      message: errorMessage,
      stack: errorStack,
      error: error,
    });
    
    // Show detailed error in popup for debugging
    const detailedError = errorMessage.includes('ENCRYPTION_KEY') 
      ? 'Encryption key error. Please check ENCRYPTION_KEY environment variable is set correctly.'
      : errorMessage;
    
    return new NextResponse(
      `<html><head><title>OAuth Error</title></head><body style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 50px auto;">
        <h2 style="color: #dc2626;">❌ OAuth Callback Error</h2>
        <p><strong>Error:</strong> ${detailedError.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <p>Please check the server logs for more details.</p>
        <button onclick="window.location.href='/dashboard'" style="padding: 10px 20px; margin-top: 20px; cursor: pointer;">Go to Dashboard</button>
        <script>
          console.error('OAuth callback error:', ${JSON.stringify(detailedError)});
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ 
                type: 'OAUTH_ERROR', 
                error: 'OAuth callback failed: ${detailedError.replace(/'/g, "\\'").replace(/\n/g, ' ')}' 
              }, window.location.origin);
              console.log('Error message sent to opener');
              setTimeout(() => {
                try { window.close(); } catch(e) { console.warn('Could not close:', e); }
              }, 2000);
            } else {
              console.log('No opener, will stay on error page');
            }
          } catch (e) {
            console.error('Error in error handler script:', e);
          }
        </script>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
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
  // Shopify CLI provides SHOPIFY_APP_URL when using 'shopify app dev'
  // Fall back to NEXT_PUBLIC_APP_URL for manual setup
  const BASE_URL = process.env.SHOPIFY_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const webhookUrl = `${BASE_URL}/api/webhooks/shopify/product-update`;
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
