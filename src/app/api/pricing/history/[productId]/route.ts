// API endpoint to fetch pricing history for a product
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error: authError } = await requireStore(request);
    if (authError) return authError;

    const { productId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from('pricing_history')
      .select('*')
      .eq('product_id', productId)
      .eq('store_id', store.id) // NEW AUTH: Filter by store
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      history: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

