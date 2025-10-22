import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient, createAdminClient } from './supabase'

export async function requireAuth(request: NextRequest) {
  const supabase = createRouteHandlerClient(request)
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return { 
      user: null, 
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) 
    }
  }
  
  // Log API access (non-blocking)
  logAuthEvent(user.id, 'api_access', request).catch(console.error)
  
  return { user, error: null }
}

export async function requireStore(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) return { user: null, store: null, error }
  
  const storeId = request.headers.get('x-store-id')
  if (!storeId) {
    return { 
      user, 
      store: null, 
      error: NextResponse.json({ error: 'x-store-id header required' }, { status: 400 }) 
    }
  }
  
  const supabase = createRouteHandlerClient(request)
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single()
  
  if (storeError || !store) {
    return { 
      user, 
      store: null, 
      error: NextResponse.json({ error: 'Store not found or access denied' }, { status: 404 }) 
    }
  }
  
  // Handle token: decrypt if encrypted, or use plain text if available
  if (store.access_token_encrypted) {
    try {
      const admin = createAdminClient()
      const { data, error: decryptError } = await admin.rpc('decrypt_token', {
        encrypted_data: store.access_token_encrypted,
        key: process.env.ENCRYPTION_KEY!
      })
      
      if (decryptError) {
        console.error('Token decryption failed:', decryptError)
        // Fall back to plain text token if decryption fails
        if (!store.access_token) {
          return { 
            user, 
            store: null, 
            error: NextResponse.json({ error: 'Failed to decrypt store token' }, { status: 500 }) 
          }
        }
      } else {
        store.access_token = data
      }
    } catch (err) {
      console.error('Token decryption error:', err)
      // Fall back to plain text if available
      if (!store.access_token) {
        return { 
          user, 
          store: null, 
          error: NextResponse.json({ error: 'Failed to decrypt store token' }, { status: 500 }) 
        }
      }
    }
  } else if (!store.access_token) {
    // No token at all
    return { 
      user, 
      store: null, 
      error: NextResponse.json({ error: 'Store has no access token configured' }, { status: 500 }) 
    }
  }
  // else: plain text token is already in store.access_token, use it as-is
  
  return { user, store, error: null }
}

async function logAuthEvent(userId: string, eventType: string, request: NextRequest) {
  try {
    const supabase = createAdminClient()
    
    await supabase.from('auth_events').insert({
      user_id: userId,
      event_type: eventType,
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      user_agent: request.headers.get('user-agent'),
      metadata: { path: request.nextUrl.pathname },
    })
  } catch (error) {
    console.error('Failed to log auth event:', error)
  }
}

