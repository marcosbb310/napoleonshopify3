import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient, createRouteHandlerClient } from '@/shared/lib/supabase'

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
    } else {
      // Create new store
      await supabaseAdmin
        .from('stores')
        .insert({
          user_id: userProfile.id,
          shop_domain: shopDomain,
          access_token_encrypted: encryptedToken,
          scope,
          installed_at: new Date().toISOString(),
          is_active: true,
        })
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
