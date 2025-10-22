// API endpoint to check current pricing config values
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .select('product_id, revenue_drop_threshold, wait_hours_after_revert, current_state, last_price_change_date, next_price_change_date');

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      configs: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

