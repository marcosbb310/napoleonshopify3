import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/shared/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const supabase = createRouteHandlerClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { productId } = await params;
    
    // Get product analytics
    const { data: analytics } = await supabase
      .from('product_analytics')
      .select('*')
      .eq('product_id', productId)
      .single();
    
    // Get recent sales data for chart
    const { data: salesData } = await supabase
      .from('sales_data')
      .select('date, revenue, units_sold')
      .eq('product_id', productId)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: true });
    
    // Get price change history
    const { data: priceHistory } = await supabase
      .from('pricing_history')
      .select('*')
      .eq('product_id', productId)
      .order('timestamp', { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      success: true,
      data: {
        analytics,
        salesData,
        priceHistory
      }
    });
  } catch (error) {
    console.error('Product analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
