import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/shared/lib/supabase'
import { createAdminClient } from '@/shared/lib/supabase'
import { getEncryptionKey } from '@/shared/lib/encryption'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Get store details using admin client
    const supabaseAdmin = createAdminClient()
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select(`
        id,
        shop_domain,
        access_token,
        access_token_encrypted,
        scope,
        is_active
      `)
      .eq('id', storeId)
      .eq('user_id', userProfile.id)
      .single()

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Test Shopify API connection
    let connectionStatus = 'disconnected'
    let errorMessage = null

    try {
      // Decrypt token if needed
      let accessToken = store.access_token
      
      if (!accessToken && store.access_token_encrypted) {
        const { data: decryptedToken } = await supabaseAdmin.rpc('decrypt_token', {
          encrypted_data: store.access_token_encrypted,
          key: getEncryptionKey(),
        })
        accessToken = decryptedToken
      }

      if (accessToken) {
        // Test connection by fetching shop info
        const shopResponse = await fetch(`https://${store.shop_domain}/admin/api/2024-10/shop.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        })

        if (shopResponse.ok) {
          connectionStatus = 'connected'
        } else {
          connectionStatus = 'error'
          errorMessage = `Shopify API error: ${shopResponse.status} ${shopResponse.statusText}`
        }
      } else {
        connectionStatus = 'error'
        errorMessage = 'No access token available'
      }
    } catch (error) {
      connectionStatus = 'error'
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
    }

    return NextResponse.json({
      success: true,
      data: {
        store_id: store.id,
        shop_domain: store.shop_domain,
        connection_status: connectionStatus,
        error_message: errorMessage,
      },
    })

  } catch (error) {
    console.error('Connection test error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}