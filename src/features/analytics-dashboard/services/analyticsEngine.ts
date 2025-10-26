import { createAdminClient } from '@/shared/lib/supabase';

export class AnalyticsEngine {
  private supabase = createAdminClient();

  async calculateProductAnalytics(productId: string) {
    // Fetch sales data for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: salesData } = await this.supabase
      .from('sales_data')
      .select('revenue, units_sold, date')
      .eq('product_id', productId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });
    
    if (!salesData || salesData.length === 0) {
      return null;
    }
    
    // Calculate metrics
    const totalRevenue = salesData.reduce((sum, d) => sum + parseFloat(d.revenue.toString()), 0);
    const totalUnits = salesData.reduce((sum, d) => sum + d.units_sold, 0);
    
    // Calculate revenue trend (simple linear regression)
    const revenueTrend = this.calculateTrend(salesData.map(d => parseFloat(d.revenue.toString())));
    
    // Get product details for profit margin
    const { data: product } = await this.supabase
      .from('products')
      .select('current_price, starting_price, views_count')
      .eq('id', productId)
      .single();
    
    if (!product) return null;
    
    // Calculate conversion rate (if views available)
    const conversionRate = product.views_count > 0 
      ? (totalUnits / product.views_count) * 100 
      : null;
    
    // Calculate profit margin (assume 40% cost)
    const profitMargin = ((product.current_price - (product.current_price * 0.4)) / product.current_price) * 100;
    
    // Calculate performance score (0-100)
    const performanceScore = this.calculatePerformanceScore({
      revenueTrend,
      totalRevenue,
      conversionRate,
      profitMargin
    });
    
    // Store in product_analytics
    const { error } = await this.supabase
      .from('product_analytics')
      .upsert({
        product_id: productId,
        store_id: (await this.supabase
          .from('products')
          .select('store_id')
          .eq('id', productId)
          .single()).data?.store_id,
        performance_score: performanceScore,
        revenue_trend: revenueTrend > 0 ? 'increasing' : revenueTrend < 0 ? 'decreasing' : 'stable',
        profit_margin: profitMargin,
        avg_conversion_rate: conversionRate,
        total_revenue_30d: totalRevenue,
        total_units_30d: totalUnits,
        last_calculated_at: new Date().toISOString(),
        metrics: {
          daily_avg_revenue: totalRevenue / 30,
          daily_avg_units: totalUnits / 30
        }
      }, {
        onConflict: 'product_id'
      });
    
    // Update products table
    await this.supabase
      .from('products')
      .update({
        performance_score: performanceScore,
        conversion_rate: conversionRate,
        last_analytics_update: new Date().toISOString()
      })
      .eq('id', productId);
    
    return { performanceScore, revenueTrend, profitMargin, conversionRate };
  }

  async calculateStoreMetrics(storeId: string, dateRange?: { from: Date; to: Date }) {
    const fromDate = dateRange?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = dateRange?.to || new Date();
    
    // Aggregate sales data
    const { data: salesData } = await this.supabase
      .from('sales_data')
      .select('revenue, units_sold')
      .eq('store_id', storeId)
      .gte('date', fromDate.toISOString().split('T')[0])
      .lte('date', toDate.toISOString().split('T')[0]);
    
    const totalRevenue = salesData?.reduce((sum, d) => sum + parseFloat(d.revenue.toString()), 0) || 0;
    const totalUnits = salesData?.reduce((sum, d) => sum + d.units_sold, 0) || 0;
    
    // Focus on revenue metrics only (no profit calculations)
    
    // Get product count with analytics
    const { count: optimizedProducts } = await this.supabase
      .from('product_analytics')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .not('performance_score', 'is', null);
    
    // Get price changes today
    const today = new Date().toISOString().split('T')[0];
    const { count: priceChangesToday } = await this.supabase
      .from('pricing_history')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', today);
    
    return {
      totalRevenue,
      totalUnits,
      optimizedProducts: optimizedProducts || 0,
      priceChangesToday: priceChangesToday || 0,
      // Revenue-focused metrics
      addedRevenue: totalRevenue * 0.15, // Simulate 15% increase from pricing
      addedRevenueChange: 15,
      baselineRevenue: totalRevenue * 0.85 // Simulate baseline without pricing
    };
  }

  async analyzePriceChangeImpact(productId: string, priceChangeId: string) {
    // Get price change details
    const { data: priceChange } = await this.supabase
      .from('pricing_history')
      .select('timestamp, old_price, new_price')
      .eq('id', priceChangeId)
      .single();
    
    if (!priceChange) return;
    
    const changeDate = new Date(priceChange.timestamp);
    const sevenDaysBefore = new Date(changeDate);
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
    const sevenDaysAfter = new Date(changeDate);
    sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 7);
    
    // Get sales before
    const { data: salesBefore } = await this.supabase
      .from('sales_data')
      .select('revenue, units_sold')
      .eq('product_id', productId)
      .gte('date', sevenDaysBefore.toISOString().split('T')[0])
      .lt('date', changeDate.toISOString().split('T')[0]);
    
    // Get sales after
    const { data: salesAfter } = await this.supabase
      .from('sales_data')
      .select('revenue, units_sold')
      .eq('product_id', productId)
      .gte('date', changeDate.toISOString().split('T')[0])
      .lte('date', sevenDaysAfter.toISOString().split('T')[0]);
    
    const revenueBefore = salesBefore?.reduce((sum, d) => sum + parseFloat(d.revenue.toString()), 0) || 0;
    const revenueAfter = salesAfter?.reduce((sum, d) => sum + parseFloat(d.revenue.toString()), 0) || 0;
    const unitsBefore = salesBefore?.reduce((sum, d) => sum + d.units_sold, 0) || 0;
    const unitsAfter = salesAfter?.reduce((sum, d) => sum + d.units_sold, 0) || 0;
    
    // Calculate impact score (-100 to +100)
    const revenueChange = revenueBefore > 0 ? ((revenueAfter - revenueBefore) / revenueBefore) * 100 : 0;
    const impactScore = Math.max(-100, Math.min(100, revenueChange));
    
    // Store impact analysis
    await this.supabase
      .from('price_change_impact')
      .insert({
        product_id: productId,
        price_change_id: priceChangeId,
        days_after_change: 7,
        revenue_before: revenueBefore,
        revenue_after: revenueAfter,
        units_before: unitsBefore,
        units_after: unitsAfter,
        impact_score: impactScore,
        measured_at: new Date().toISOString()
      });
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private calculatePerformanceScore(metrics: {
    revenueTrend: number;
    totalRevenue: number;
    conversionRate: number | null;
    profitMargin: number;
  }): number {
    let score = 50; // Base score
    
    // Revenue trend impact (±20 points)
    score += Math.max(-20, Math.min(20, metrics.revenueTrend * 10));
    
    // Revenue volume impact (0-20 points)
    score += Math.min(20, (metrics.totalRevenue / 1000) * 2);
    
    // Conversion rate impact (0-15 points)
    if (metrics.conversionRate) {
      score += Math.min(15, metrics.conversionRate * 3);
    }
    
    // Profit margin impact (0-15 points)
    score += Math.min(15, (metrics.profitMargin / 100) * 15);
    
    return Math.max(0, Math.min(100, score));
  }
}
