import { task } from "@trigger.dev/sdk/v3";
import { AnalyticsEngine } from '@/features/analytics-dashboard/services/analyticsEngine';
import { createAdminClient } from '@/shared/lib/supabase';

export const dailyAnalyticsRefresh = task({
  id: "daily-analytics-refresh",
  run: async (payload: { storeId?: string }) => {
    const supabase = createAdminClient();
    const engine = new AnalyticsEngine();
    
    // Get stores to process
    const query = supabase
      .from('stores')
      .select('id, shop_domain')
      .eq('is_active', true);
    
    if (payload.storeId) {
      query.eq('id', payload.storeId);
    }
    
    const { data: stores } = await query;
    
    if (!stores) return { success: false, error: 'No stores found' };
    
    let processed = 0;
    let errors = 0;
    
    for (const store of stores) {
      // Get all products for store
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', store.id)
        .eq('is_active', true);
      
      if (!products) continue;
      
      // Calculate analytics for each product
      for (const product of products) {
        try {
          await engine.calculateProductAnalytics(product.id);
          processed++;
        } catch (error) {
          console.error(`Failed to calculate analytics for ${product.id}:`, error);
          errors++;
        }
      }
    }
    
    // Refresh materialized view
    await supabase.rpc('refresh_product_performance_view');
    
    return {
      success: errors === 0,
      processed,
      errors,
      stores: stores.length
    };
  },
});
