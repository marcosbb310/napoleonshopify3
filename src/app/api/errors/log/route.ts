import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/shared/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    
    const body = await request.json();
    
    // Get user_id from users table if authenticated
    let userId = null;
    if (user) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
      userId = userRecord?.id;
    }
    
    // Insert error log (gracefully handle missing table)
    try {
      const { error } = await supabase
        .from('error_logs')
        .insert({
          user_id: userId,
          error_type: body.error_type,
          error_message: body.error_message,
          stack_trace: body.stack_trace,
          context: body.context || {},
          severity: body.severity || 'medium'
        });
      
      if (error) {
        console.error('Failed to log error:', error);
        // Don't fail the request if error logging fails
        return NextResponse.json({ success: false, error: 'Error logging unavailable' }, { status: 200 });
      }
      
      return NextResponse.json({ success: true });
    } catch (tableError) {
      // If error_logs table doesn't exist, just log to console and return success
      console.error('Error logs table not available:', tableError);
      return NextResponse.json({ success: false, error: 'Error logging unavailable' }, { status: 200 });
    }
  } catch (error) {
    console.error('Error logging endpoint failed:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
