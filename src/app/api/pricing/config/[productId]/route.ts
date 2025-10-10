// API endpoints for pricing configuration management
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/shared/lib/supabase';

// GET pricing config for a product
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { productId } = params;

    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .select('*')
      .eq('product_id', productId)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, config: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// PATCH pricing config for a product
export async function PATCH(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { productId } = params;
    const body = await request.json();

    // Allowed fields to update
    const allowedFields = [
      'auto_pricing_enabled',
      'increment_percentage',
      'period_days',
      'revenue_drop_threshold',
      'wait_days_after_revert',
      'max_increase_percentage',
    ];

    const updates: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .update(updates)
      .eq('product_id', productId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration updated',
      config: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST to approve max cap increase
export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { productId } = params;
    const body = await request.json();
    const { newMaxPercentage } = body;

    if (!newMaxPercentage || typeof newMaxPercentage !== 'number') {
      return NextResponse.json(
        { success: false, error: 'newMaxPercentage is required and must be a number' },
        { status: 400 }
      );
    }

    // Update max cap and reset state to increasing
    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .update({
        max_increase_percentage: newMaxPercentage,
        current_state: 'increasing',
      })
      .eq('product_id', productId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Max cap increased to ${newMaxPercentage}%`,
      config: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

