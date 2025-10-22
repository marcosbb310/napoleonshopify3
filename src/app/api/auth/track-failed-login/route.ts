import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/shared/lib/supabase'

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 15

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '0.0.0.0'

    const { data: existing, error: fetchError } = await supabase
      .from('failed_login_attempts')
      .select('*')
      .eq('email', email)
      .eq('ip_address', ip)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching failed attempts:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (existing) {
      // Increment attempt count
      const newCount = existing.attempt_count + 1
      const lockedUntil = newCount >= MAX_ATTEMPTS 
        ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000) 
        : null

      const { error: updateError } = await supabase
        .from('failed_login_attempts')
        .update({
          attempt_count: newCount,
          locked_until: lockedUntil?.toISOString() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Error updating failed attempts:', updateError)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from('failed_login_attempts')
        .insert({
          email,
          ip_address: ip,
          attempt_count: 1,
        })

      if (insertError) {
        console.error('Error inserting failed attempt:', insertError)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Track failed login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

