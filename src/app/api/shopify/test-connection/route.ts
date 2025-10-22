import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const { storeId, shopDomain } = await request.json();

    if (!storeId || !shopDomain) {
      return NextResponse.json(
        { success: false, error: 'Missing store ID or shop domain' },
        { status: 400 }
      );
    }

    // Get store credentials from database
    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .select('access_token, shop_domain, is_active')
      .eq('id', storeId)
      .eq('shop_domain', shopDomain)
      .single();

    if (error || !store) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404 }
      );
    }

    if (!store.is_active) {
      return NextResponse.json(
        { success: false, error: 'Store is inactive' },
        { status: 400 }
      );
    }

    if (!store.access_token) {
      return NextResponse.json(
        { success: false, error: 'No access token found' },
        { status: 400 }
      );
    }

    // Test the connection by making a simple API call to Shopify
    const testUrl = `https://${shopDomain}/admin/api/2024-10/shop.json`;
    
    const response = await fetch(testUrl, {
      headers: {
        'X-Shopify-Access-Token': store.access_token,
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      // Try to get more specific error info
      const errorData = await response.text();
      console.error('Shopify API error:', response.status, errorData);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Shopify API returned ${response.status}`,
          details: response.status === 401 ? 'Invalid or expired access token' : errorData
        },
        { status: response.status }
      );
    }

    // Parse the response to ensure it's valid
    try {
      const shopData = await response.json();
      if (!shopData.shop || !shopData.shop.id) {
        throw new Error('Invalid shop data received');
      }
    } catch (parseError) {
      console.error('Failed to parse Shopify response:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid response from Shopify' },
        { status: 500 }
      );
    }

    // Update last_synced_at to indicate successful connection
    await supabaseAdmin
      .from('stores')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', storeId);

    return NextResponse.json({ 
      success: true,
      message: 'Connection successful'
    });

  } catch (error) {
    console.error('Connection test error:', error);
    
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { success: false, error: 'Connection timeout - Shopify may be temporarily unavailable' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Connection test failed' },
      { status: 500 }
    );
  }
}
