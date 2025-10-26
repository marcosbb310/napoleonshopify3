import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/shared/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!storeId) {
      return NextResponse.json({ error: 'storeId required' }, { status: 400 });
    }
    
    // Use materialized view for fast queries
    const { data: topPerformers } = await supabase
      .from('mv_product_performance')
      .select('*')
      .eq('store_id', storeId)
      .order('performance_score', { ascending: false })
      .limit(limit);
    
    return NextResponse.json({
      success: true,
      data: topPerformers || []
    });
  } catch (error) {
    console.error('Top performers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top performers' },
      { status: 500 }
    );
  }
}
