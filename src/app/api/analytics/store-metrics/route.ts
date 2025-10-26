import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/shared/lib/supabase';
import { AnalyticsEngine } from '@/features/analytics-dashboard/services/analyticsEngine';
import { validateRequest, storeIdSchema } from '@/shared/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    
    if (!storeId) {
      return NextResponse.json({ error: 'storeId required' }, { status: 400 });
    }
    
    // Validate storeId format
    try {
      validateRequest(storeIdSchema, storeId);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid storeId format' }, { status: 400 });
    }
    
    // Verify user owns this store
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .single();
    
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    
    const engine = new AnalyticsEngine();
    const dateRange = from && to ? {
      from: new Date(from),
      to: new Date(to)
    } : undefined;
    
    const metrics = await engine.calculateStoreMetrics(storeId, dateRange);
    
    return NextResponse.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Store metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
