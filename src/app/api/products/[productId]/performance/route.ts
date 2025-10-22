// API endpoint to fetch product performance data
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  try {
    console.log('=== Performance API called ===');
    const resolvedParams = await context.params;
    const productId = resolvedParams.productId;
    console.log('Product ID:', productId);

    // Simple test first - just return mock data to verify route works
    console.log('Testing route - returning mock data');
    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: 'test-id',
          shopifyId: productId,
          title: 'Test Product',
          startingPrice: 50,
          currentPrice: 55,
          autoPricingEnabled: true,
          lastPriceChange: new Date().toISOString(),
        },
        summary: {
          totalRevenue: 1000,
          totalUnits: 20,
          avgPrice: 50,
          baselineRevenue: 900,
          revenueIncrease: 100,
          revenueIncreasePercent: 11.1,
          priceChanges: 3,
        },
        priceHistory: [],
        salesData: [],
      },
    });

    /* Temporarily commented out to test route
    // Try to find product by shopify_id first (coming from frontend)
    let productQuery = supabaseAdmin
      .from('products')
      .select(`
        id,
        shopify_id,
        title,
        starting_price,
        current_price,
        pricing_config (
          auto_pricing_enabled,
          last_price_change_date
        )
      `)
      .eq('shopify_id', productId);

    let { data: product, error: productError } = await productQuery.single();

    // If not found by shopify_id, try UUID
    if (productError || !product) {
      const uuidQuery = await supabaseAdmin
        .from('products')
        .select(`
          id,
          shopify_id,
          title,
          starting_price,
          current_price,
          pricing_config (
            auto_pricing_enabled,
            last_price_change_date
          )
        `)
        .eq('id', productId)
        .single();
      
      product = uuidQuery.data;
      productError = uuidQuery.error;
    }

    if (productError || !product) {
      console.error('Product not found:', productId, productError);
      return NextResponse.json(
        { success: false, error: 'Product not found', details: productError?.message },
        { status: 404 }
      );
    }
    */

    /* Temporarily commented out
    // Fetch pricing history
    const { data: priceHistory, error: historyError } = await supabaseAdmin
      .from('pricing_history')
      .select('*')
      .eq('product_id', product.id)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (historyError) {
      console.error('Error fetching price history:', historyError);
    }

    // Fetch sales data (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: salesData, error: salesError } = await supabaseAdmin
      .from('sales_data')
      .select('*')
      .eq('product_id', product.id)
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (salesError) {
      console.error('Error fetching sales data:', salesError);
    }

    // Get pricing config (handle array from Supabase relationship)
    const pricingConfig = Array.isArray(product.pricing_config) 
      ? product.pricing_config[0] 
      : product.pricing_config;

    // Calculate performance metrics
    const totalRevenue = salesData?.reduce((sum, day) => sum + Number(day.revenue), 0) || 0;
    const totalUnits = salesData?.reduce((sum, day) => sum + Number(day.units_sold), 0) || 0;
    const avgPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;

    // Calculate revenue at base price (if smart pricing hadn't been enabled)
    const baselineRevenue = totalUnits * Number(product.starting_price);
    const revenueIncrease = totalRevenue - baselineRevenue;
    const revenueIncreasePercent = baselineRevenue > 0 ? (revenueIncrease / baselineRevenue) * 100 : 0;

    // Group sales by price points from price history
    const pricePerformance = priceHistory?.map(change => {
      const changeDate = new Date(change.timestamp);
      const nextChange = priceHistory.find(h => new Date(h.timestamp) < changeDate);
      const nextChangeDate = nextChange ? new Date(nextChange.timestamp) : new Date();

      // Find sales data between this price change and the next
      const salesInPeriod = salesData?.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= changeDate && saleDate < nextChangeDate;
      }) || [];

      const periodRevenue = salesInPeriod.reduce((sum, day) => sum + Number(day.revenue), 0);
      const periodUnits = salesInPeriod.reduce((sum, day) => sum + Number(day.units_sold), 0);

      return {
        date: change.timestamp,
        oldPrice: Number(change.old_price),
        newPrice: Number(change.new_price),
        action: change.action,
        reason: change.reason,
        revenue: periodRevenue,
        units: periodUnits,
        revenuePreviousPeriod: change.revenue_previous_period ? Number(change.revenue_previous_period) : null,
        revenueCurrentPeriod: change.revenue_current_period ? Number(change.revenue_current_period) : null,
        revenueChangePercent: change.revenue_change_percent ? Number(change.revenue_change_percent) : null,
      };
    }) || [];

    // This code is now unreachable due to early return above
    // Will re-enable after route is confirmed working
    */
  } catch (error) {
    console.error('Performance API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message, stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}

