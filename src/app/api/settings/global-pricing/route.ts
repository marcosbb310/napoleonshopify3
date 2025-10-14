// API endpoint for global smart pricing setting
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/shared/lib/supabase';

/**
 * GET /api/settings/global-pricing
 * Get the current global smart pricing enabled state
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('global_settings')
      .select('value')
      .eq('key', 'smart_pricing_global_enabled')
      .single();

    if (error) {
      console.error('Error fetching global pricing setting:', error);
      console.error('Error details:', {
        message: error.message,
        hint: error.hint,
        details: error.details,
        code: error.code
      });
      
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Database table not found',
            details: 'The global_settings table does not exist. Please run the migration.',
            migration: 'supabase/migrations/002_add_global_settings.sql'
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch setting',
          details: error.message 
        },
        { status: 500 }
      );
    }

    // Parse the JSONB value
    const enabled = data?.value === true || data?.value === 'true';

    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/global-pricing
 * Update the global smart pricing enabled state
 * Body: { enabled: boolean }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('global_settings')
      .update({ value: enabled })
      .eq('key', 'smart_pricing_global_enabled');

    if (error) {
      console.error('Error updating global pricing setting:', error);
      console.error('Error details:', {
        message: error.message,
        hint: error.hint,
        details: error.details,
        code: error.code
      });
      
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Database table not found',
            details: 'The global_settings table does not exist. Please run the migration.',
            migration: 'supabase/migrations/002_add_global_settings.sql'
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to update setting',
          details: error.message 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      enabled,
      message: enabled 
        ? 'Smart pricing enabled globally' 
        : 'Smart pricing disabled globally' 
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

