import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/shopify/v2/verify-urls
 * 
 * Debug endpoint to verify OAuth URL configuration
 */
export async function GET(request: NextRequest) {
  const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
  const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL;
  const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
  
  const BASE_URL = SHOPIFY_APP_URL || NEXT_PUBLIC_APP_URL;
  
  if (!BASE_URL) {
    return NextResponse.json({
      error: 'No BASE_URL configured',
      env: {
        SHOPIFY_APP_URL: SHOPIFY_APP_URL || 'NOT SET',
        NEXT_PUBLIC_APP_URL: NEXT_PUBLIC_APP_URL || 'NOT SET',
      },
    }, { status: 500 });
  }

  const trimmed = BASE_URL.trim().replace(/\/+$/, '');
  const redirectUri = `${trimmed}/api/auth/shopify/v2/callback`.replace(/([^:]\/)\/+/g, '$1');
  
  let parsedBase: URL;
  let parsedRedirect: URL;
  
  try {
    parsedBase = new URL(trimmed);
    parsedRedirect = new URL(redirectUri);
  } catch (e) {
    return NextResponse.json({
      error: 'Invalid URL format',
      base: trimmed,
      redirect: redirectUri,
      errorDetails: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }

  // Extract host components
  const baseHost = {
    protocol: parsedBase.protocol,
    hostname: parsedBase.hostname,
    port: parsedBase.port || (parsedBase.protocol === 'https:' ? '443' : '80'),
    host: parsedBase.host,
    origin: parsedBase.origin,
  };

  const redirectHost = {
    protocol: parsedRedirect.protocol,
    hostname: parsedRedirect.hostname,
    port: parsedRedirect.port || (parsedRedirect.protocol === 'https:' ? '443' : '80'),
    host: parsedRedirect.host,
    origin: parsedRedirect.origin,
    pathname: parsedRedirect.pathname,
    href: parsedRedirect.href,
  };

  const hostsMatch = 
    baseHost.hostname === redirectHost.hostname &&
    baseHost.port === redirectHost.port &&
    baseHost.protocol === redirectHost.protocol;

  return NextResponse.json({
    success: true,
    configuration: {
      BASE_URL: {
        raw: BASE_URL,
        trimmed,
        parsed: baseHost,
      },
      redirectUri: {
        constructed: redirectUri,
        parsed: redirectHost,
      },
      validation: {
        hostsMatch,
        matchDetails: {
          hostname: baseHost.hostname === redirectHost.hostname,
          port: baseHost.port === redirectHost.port,
          protocol: baseHost.protocol === redirectHost.protocol,
        },
      },
    },
    requiredPartnerDashboard: {
      appUrl: trimmed,
      redirectUrls: [redirectUri],
      critical: 'Both must have matching hosts (protocol + hostname + port)',
    },
    env: {
      SHOPIFY_APP_URL: SHOPIFY_APP_URL || 'NOT SET',
      NEXT_PUBLIC_APP_URL: NEXT_PUBLIC_APP_URL || 'NOT SET',
      SHOPIFY_API_KEY_SET: !!SHOPIFY_API_KEY,
    },
  });
}

