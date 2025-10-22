// Test endpoint to check if global_settings table exists
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

/**
 * GET /api/settings/global-pricing/test
 * Test if the global_settings table exists and is accessible
 */
export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();
    // Try to query the table
    const { data, error } = await supabaseAdmin
      .from('global_settings')
      .select('*')
      .limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        hint: error.hint,
        details: error.details,
        message: 'Database query failed. The table might not exist or there are permission issues.',
        solution: 'Run the migration: supabase/migrations/002_add_global_settings.sql in your Supabase SQL Editor'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'global_settings table exists and is accessible',
      recordsFound: data?.length || 0,
      data: data
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Unexpected error connecting to database'
    }, { status: 500 });
  }
}

