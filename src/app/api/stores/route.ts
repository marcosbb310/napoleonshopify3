import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/shared/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const { user, error } = await requireAuth(request);
    if (error) return error;

    // Get stores for the authenticated user
    const { createAdminClient } = await import('@/shared/lib/supabase');
    const supabaseAdmin = createAdminClient();
    
    // First get user profile to get the user ID
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();
    
    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'User profile not found', statusCode: 404 } },
        { status: 404 }
      );
    }

    // Get stores for this user
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('installed_at', { ascending: false });

    if (storesError) {
      console.error('Failed to fetch stores:', storesError);
      return NextResponse.json(
        { success: false, error: { message: 'Failed to fetch stores', statusCode: 500 } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: stores || [] }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      { success: false, error: { message, statusCode: 500 } },
      { status: 500 }
    );
  }
}
