import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/shared/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '0.0.0.0'

    const { data: attempts, error } = await supabase
      .from('failed_login_attempts')
      .select('*')
      .eq('email', email)
      .eq('ip_address', ip)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, which is fine
      console.error('Error checking login attempts:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (attempts && attempts.locked_until) {
      const lockedUntil = new Date(attempts.locked_until)
      if (lockedUntil > new Date()) {
        const minutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
        return NextResponse.json(
          { error: `Account temporarily locked. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.` },
          { status: 429 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Check login attempts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

