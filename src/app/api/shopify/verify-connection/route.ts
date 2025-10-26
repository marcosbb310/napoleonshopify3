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
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select(`
        id,
        shop_domain,
        access_token,
        access_token_encrypted,
        scope,
        is_active,
        last_synced_at
      `)
      .eq('id', storeId)
      .single()

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Verify user owns this store
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get store with user relationship
    const { data: storeWithUser } = await supabaseAdmin
      .from('stores')
      .select(`
        id,
        user_id,
        shop_domain,
        access_token,
        access_token_encrypted,
        scope,
        is_active,
        last_synced_at
      `)
      .eq('id', storeId)
      .eq('user_id', userProfile.id)
      .single()

    if (!storeWithUser) {
      return NextResponse.json({ error: 'Store not found or access denied' }, { status: 404 })
    }

    // Test Shopify API connection
    let connectionStatus = 'disconnected'
    let shopInfo = null
    let productCount = 0
    let errorMessage = null

    try {
      // Decrypt token if needed
      let accessToken = storeWithUser.access_token
      
      if (!accessToken && storeWithUser.access_token_encrypted) {
        const { data: decryptedToken } = await supabaseAdmin.rpc('decrypt_token', {
          encrypted_data: storeWithUser.access_token_encrypted,
          key: getEncryptionKey(),
        })
        accessToken = decryptedToken
      }

      if (accessToken) {
        // Test connection by fetching shop info
        const shopResponse = await fetch(`https://${storeWithUser.shop_domain}/admin/api/2024-10/shop.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        })

        if (shopResponse.ok) {
          shopInfo = await shopResponse.json()
          connectionStatus = 'connected'

          // Get product count
          const productsResponse = await fetch(`https://${storeWithUser.shop_domain}/admin/api/2024-10/products/count.json`, {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          })

          if (productsResponse.ok) {
            const productsData = await productsResponse.json()
            productCount = productsData.count || 0
          }
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
        store: {
          id: storeWithUser.id,
          shop_domain: storeWithUser.shop_domain,
          scope: storeWithUser.scope,
          is_active: storeWithUser.is_active,
          last_synced_at: storeWithUser.last_synced_at,
        },
        connection: {
          status: connectionStatus,
          shop_info: shopInfo,
          product_count: productCount,
          error_message: errorMessage,
        },
      },
    })

  } catch (error) {
    console.error('Store verification error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
