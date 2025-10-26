import { schedules } from "@trigger.dev/sdk";
import { runPricingAlgorithm } from "@/features/pricing-engine/services/pricingAlgorithm";
import { AnalyticsEngine } from '@/features/analytics-dashboard/services/analyticsEngine';
import { createAdminClient } from '@/shared/lib/supabase';

/**
 * Daily Pricing Optimization Task
 * 
 * Runs every day at 2 AM UTC to check all products with enabled smart pricing
 * and update prices based on revenue performance.
 * 
 * The algorithm:
 * - Only processes products where next_price_change_date <= today
 * - Increases prices by 5% every 2 days
 * - Monitors revenue and reverts if it drops >1%
 * - Respects manual price changes via webhook integration
 */
export const dailyPricingTask = schedules.task({
  id: "daily-pricing-optimization",
  // Run at 2 AM UTC every day
  cron: "0 2 * * *",
  run: async (payload) => {
    console.log("🚀 Starting daily pricing algorithm run...");
    
    // Get all stores and run pricing for each
    const supabaseAdmin = createAdminClient();
    const { data: stores } = await supabaseAdmin
      .from('stores')
      .select('id, shop_domain, access_token')
      .eq('is_active', true);

    if (!stores || stores.length === 0) {
      console.log("ℹ️ No active stores found");
      return { success: true, stats: { processed: 0, increased: 0, reverted: 0, waiting: 0 } };
    }

    let totalStats = { processed: 0, increased: 0, reverted: 0, waiting: 0 };
    const allErrors: string[] = [];
    
    for (const store of stores) {
      console.log(`🔄 Processing store: ${store.shop_domain}`);
      const result = await runPricingAlgorithm(store.id, store.shop_domain, store.access_token);
      
      if (!result.success) {
        console.error(`❌ Algorithm encountered errors for store ${store.shop_domain}:`, result.errors);
        allErrors.push(...result.errors);
        continue;
      }
      
      // Aggregate stats
      totalStats.processed += result.stats.processed;
      totalStats.increased += result.stats.increased;
      totalStats.reverted += result.stats.reverted;
      totalStats.waiting += result.stats.waiting;
    }
    
    console.log("✅ Pricing algorithm completed successfully");
    console.log(`📊 Stats: ${JSON.stringify(totalStats, null, 2)}`);
    
    return {
      success: allErrors.length === 0,
      stats: totalStats,
      errors: allErrors,
      timestamp: new Date().toISOString(),
    };
  },
});

