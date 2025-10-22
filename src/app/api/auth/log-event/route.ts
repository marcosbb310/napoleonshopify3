import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/shared/lib/apiAuth'
import { createAdminClient } from '@/shared/lib/supabase'

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) return error

  try {
    const { event } = await request.json()
    
    if (!event) {
      return NextResponse.json({ error: 'Event type is required' }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')

    const { error: insertError } = await supabase.from('auth_events').insert({
      user_id: user.id,
      event_type: event,
      ip_address: ip,
      user_agent: request.headers.get('user-agent'),
      metadata: { path: request.nextUrl.pathname },
    })

    if (insertError) {
      console.error('Error logging auth event:', insertError)
      return NextResponse.json({ error: 'Failed to log event' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Log event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

