import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/shared/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const shop = searchParams.get('shop');
    
    const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
    const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      return NextResponse.json(
        { error: 'Shopify credentials not configured' },
        { status: 500 }
      );
    }

    // Validate required parameters
    if (!code || !state || !shop) {
      return NextResponse.json(
        { error: 'Missing required OAuth parameters' },
        { status: 400 }
      );
    }

    // Verify nonce from cookies
    const storedNonce = request.cookies.get('shopify_oauth_nonce')?.value;
    const storedShop = request.cookies.get('shopify_oauth_shop')?.value;

    if (!storedNonce || state !== storedNonce) {
      return NextResponse.json(
        { error: 'Invalid OAuth state' },
        { status: 400 }
      );
    }

    if (!storedShop || shop !== storedShop) {
      return NextResponse.json(
        { error: 'Shop domain mismatch' },
        { status: 400 }
      );
    }

    const shopDomain = shop.includes('.myshopify.com') 
      ? shop 
      : `${shop}.myshopify.com`;

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.json(
        { error: 'Failed to exchange code for access token' },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, scope } = tokenData;

    if (!access_token) {
      return NextResponse.json(
        { error: 'No access token received' },
        { status: 400 }
      );
    }

    // Verify HMAC signature (recommended for production)
    const hmac = searchParams.get('hmac');
    if (hmac && SHOPIFY_API_SECRET) {
      const queryString = new URLSearchParams(searchParams);
      queryString.delete('hmac');
      queryString.delete('signature');
      
      const sortedParams = Array.from(queryString.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

      const calculatedHmac = crypto
        .createHmac('sha256', SHOPIFY_API_SECRET)
        .update(sortedParams)
        .digest('hex');

      if (hmac !== calculatedHmac) {
        return NextResponse.json(
          { error: 'Invalid HMAC signature' },
          { status: 400 }
        );
      }
    }

    // Get shop information from Shopify
    const shopResponse = await fetch(`https://${shopDomain}/admin/api/2024-10/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': access_token,
      },
    });

    if (!shopResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch shop information' },
        { status: 400 }
      );
    }

    const shopData = await shopResponse.json();
    const shopInfo = shopData.shop;

    // Check if store already exists
    const { data: existingStore } = await supabaseAdmin
      .from('stores')
      .select('*, users(*)')
      .eq('shop_domain', shopDomain)
      .single();

    let userId: string;
    let storeId: string;

    if (existingStore) {
      // Update existing store
      userId = existingStore.user_id;
      const { data: updatedStore } = await supabaseAdmin
        .from('stores')
        .update({
          access_token: access_token,
          scope: scope,
          last_synced_at: new Date().toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingStore.id)
        .select()
        .single();

      if (!updatedStore) {
        throw new Error('Failed to update store');
      }
      storeId = updatedStore.id;
    } else {
      // Create new user and store
      // For now, we'll create a user with email from shop name
      // In production, you might want to collect user email during OAuth
      const userEmail = `${shopInfo.myshopify_domain.split('.')[0]}@shopify-store.local`;
      
      const { data: newUser, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          email: userEmail,
          name: shopInfo.name || shopInfo.myshopify_domain,
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error('User creation error:', userError);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }

      userId = newUser.id;

      // Create store record
      const { data: newStore, error: storeError } = await supabaseAdmin
        .from('stores')
        .insert({
          user_id: userId,
          shop_domain: shopDomain,
          access_token: access_token,
          scope: scope,
          installed_at: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (storeError || !newStore) {
        console.error('Store creation error:', storeError);
        return NextResponse.json(
          { error: 'Failed to create store record' },
          { status: 500 }
        );
      }

      storeId = newStore.id;
    }

    // Create response and set session cookies
    const response = NextResponse.redirect(`${BASE_URL}/dashboard`);
    
    // Clear OAuth cookies
    response.cookies.delete('shopify_oauth_nonce');
    response.cookies.delete('shopify_oauth_shop');
    
    // Set session cookies (in production, use secure session tokens)
    response.cookies.set('user_id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    
    response.cookies.set('store_id', storeId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { error: 'OAuth callback failed' },
      { status: 500 }
    );
  }
}
