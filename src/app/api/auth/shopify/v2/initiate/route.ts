import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/shared/lib/supabase';
import { generatePKCEPair } from '@/shared/lib/pkce';
import { createSession } from '@/features/shopify-oauth/services/sessionService';
import { validateShopDomain } from '@/features/shopify-oauth/services/shopValidationService';
import type { OAuthInitiateRequest, OAuthInitiateResponse } from '@/features/shopify-oauth/types';

/**
 * POST /api/auth/shopify/v2/initiate
 * 
 * Initiates OAuth flow with PKCE
 * 
 * Request body:
 * {
 *   "shopDomain": "mystore.myshopify.com"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "oauthUrl": "https://mystore.myshopify.com/admin/oauth/authorize?...",
 *   "sessionId": "uuid"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify user is authenticated
    const supabase = createRouteHandlerClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!user || authError) {
      return NextResponse.json<OAuthInitiateResponse>(
        {
          success: false,
          error: 'You must be logged in to connect a store',
          errorCode: 'USER_NOT_AUTHENTICATED',
        },
        { status: 401 }
      );
    }

    // Step 2: Get user profile from public.users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json<OAuthInitiateResponse>(
        {
          success: false,
          error: 'User profile not found',
          errorCode: 'USER_NOT_AUTHENTICATED',
        },
        { status: 401 }
      );
    }

    // Step 3: Parse and validate request body
    const body = await request.json() as OAuthInitiateRequest;
    
    if (!body.shopDomain) {
      return NextResponse.json<OAuthInitiateResponse>(
        {
          success: false,
          error: 'Shop domain is required',
          errorCode: 'INVALID_SHOP_DOMAIN',
        },
        { status: 400 }
      );
    }

    // Step 4: Validate shop domain
    const validation = await validateShopDomain(body.shopDomain);
    
    if (!validation.isValid) {
      return NextResponse.json<OAuthInitiateResponse>(
        {
          success: false,
          error: validation.error || 'Invalid shop domain',
          errorCode: validation.errorCode || 'INVALID_SHOP_DOMAIN',
        },
        { status: 400 }
      );
    }

    // Step 5: Generate PKCE pair
    const pkce = generatePKCEPair();

    // Step 6: Create OAuth session in database
    const session = await createSession({
      userId: userProfile.id,
      shopDomain: validation.shopDomain,
      pkce,
    });

    // Step 7: Build OAuth URL
    const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
    const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || 'read_products,write_products,read_orders';
    
    // Shopify CLI provides SHOPIFY_APP_URL when using 'shopify app dev'
    // Fall back to NEXT_PUBLIC_APP_URL for manual setup
    let BASE_URL = process.env.SHOPIFY_APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!SHOPIFY_API_KEY || !BASE_URL) {
      return NextResponse.json<OAuthInitiateResponse>(
        {
          success: false,
          error: 'Server configuration error: Missing SHOPIFY_APP_URL or NEXT_PUBLIC_APP_URL',
          errorCode: 'UNKNOWN_ERROR',
        },
        { status: 500 }
      );
    }

    // CRITICAL: Remove any trailing slashes and whitespace
    BASE_URL = BASE_URL.trim().replace(/\/+$/, '');
    
    // Build redirect URI - ensure no double slashes
    const redirectUri = `${BASE_URL}/api/auth/shopify/v2/callback`.replace(/([^:]\/)\/+/g, '$1');
    
    // Parse to validate URL format
    let parsedRedirectUri: URL;
    try {
      parsedRedirectUri = new URL(redirectUri);
    } catch (e) {
      console.error('❌ Invalid redirect URI format:', redirectUri, e);
      return NextResponse.json<OAuthInitiateResponse>(
        {
          success: false,
          error: `Invalid redirect URI format: ${redirectUri}`,
          errorCode: 'INVALID_REDIRECT_URI',
        },
        { status: 500 }
      );
    }
    
    const oauthUrl = new URL(`https://${validation.shopDomain}/admin/oauth/authorize`);
    oauthUrl.searchParams.set('client_id', SHOPIFY_API_KEY);
    oauthUrl.searchParams.set('scope', SHOPIFY_SCOPES);
    
    // CRITICAL: Use the parsed URL's href to ensure proper encoding
    // Shopify requires the redirect_uri to match EXACTLY what's in Partner Dashboard
    // IMPORTANT: Use .href (not .toString()) to get the canonical URL format
    // Also ensure no URL encoding issues by using the raw href
    const finalRedirectUri = parsedRedirectUri.href;
    oauthUrl.searchParams.set('redirect_uri', finalRedirectUri);
    oauthUrl.searchParams.set('state', session.state);
    // Note: Shopify doesn't support PKCE yet, but we use it for our own security
    // We verify the code_verifier on callback

    // EXTENSIVE DEBUGGING: Log everything that matters
    console.log('🔐 OAuth initiated - DETAILED DEBUG:', {
      shopDomain: validation.shopDomain,
      sessionId: session.id,
      state: session.state,
      env: {
        SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL || 'NOT SET',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
        SHOPIFY_API_KEY_SET: !!SHOPIFY_API_KEY,
      },
      BASE_URL: {
        raw: BASE_URL,
        trimmed: BASE_URL.trim(),
        parsed: parsedRedirectUri.host + parsedRedirectUri.port ? `:${parsedRedirectUri.port}` : '',
      },
      redirectUri: {
        constructed: redirectUri,
        parsed_href: parsedRedirectUri.href,
        parsed_host: parsedRedirectUri.host,
        parsed_hostname: parsedRedirectUri.hostname,
        parsed_port: parsedRedirectUri.port || (parsedRedirectUri.protocol === 'https:' ? '443' : '80'),
        parsed_protocol: parsedRedirectUri.protocol,
        parsed_pathname: parsedRedirectUri.pathname,
        parsed_origin: parsedRedirectUri.origin,
        encoded: encodeURIComponent(parsedRedirectUri.href),
      },
      oauthUrl: {
        full: oauthUrl.toString(),
        redirect_uri_param: oauthUrl.searchParams.get('redirect_uri'),
      },
    });

    // Step 8: Return OAuth URL
    return NextResponse.json<OAuthInitiateResponse>({
      success: true,
      oauthUrl: oauthUrl.toString(),
      sessionId: session.id,
    });

  } catch (error) {
    console.error('❌ OAuth initiation error:', error);
    
    return NextResponse.json<OAuthInitiateResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate OAuth',
        errorCode: 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}
