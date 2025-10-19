import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/shared/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get user_id from httpOnly cookie
    const userId = request.cookies.get('user_id')?.value;
    
    if (!userId) {
      return NextResponse.json({
        isAuthenticated: false,
        user: null
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    
    // Load user data
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        isAuthenticated: false,
        user: null
      });
    }

    return NextResponse.json({
      isAuthenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: null,
      }
    });

  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({
      isAuthenticated: false,
      user: null
    });
  }
}
