import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/shared/lib/supabase'

/**
 * POST /api/auth/track-login
 * 
 * Tracks successful user login
 * Updates last_login_at, login_count, and last_activity_at
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    
    // Call the database function to track login
    const { error } = await supabase.rpc('track_user_login', {
      p_user_id: userId
    })
    
    if (error) {
      console.error('Error tracking login:', error)
      // Don't fail the request if tracking fails
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Track login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

