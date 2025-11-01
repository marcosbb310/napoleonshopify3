import { schedules } from "@trigger.dev/sdk";
import { runPricingAlgorithm } from "@/features/pricing-engine/services/pricingAlgorithm";
import { createAdminClient } from "@/shared/lib/supabase";
import { getDecryptedTokens } from "@/features/shopify-oauth/services/tokenService";

/**
 * Daily Pricing Optimization Task
 * 
 * Runs every day at 2 AM UTC to check all products with enabled smart pricing
 * and update prices based on revenue performance.
 * 
 * The algorithm:
 * - Respects global smart pricing toggle (checks global_settings table)
 * - Only processes products where auto_pricing_enabled = true
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
    
    // Get all active stores and run pricing for each
    const supabaseAdmin = createAdminClient();
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, shop_domain')
      .eq('is_active', true);

    if (storesError) {
      console.error("❌ Failed to fetch stores:", storesError);
      throw new Error(`Failed to fetch stores: ${storesError.message}`);
    }

    if (!stores || stores.length === 0) {
      console.log("ℹ️ No active stores found");
      return {
        success: true,
        stats: { processed: 0, increased: 0, reverted: 0, waiting: 0 },
        errors: [],
        timestamp: new Date().toISOString(),
      };
    }

    console.log(`📋 Found ${stores.length} active store(s) to process`);

    // Aggregate stats across all stores
    let totalStats = { processed: 0, increased: 0, reverted: 0, waiting: 0 };
    const allErrors: string[] = [];

    // Process each store
    for (const store of stores) {
      console.log(`🔄 Processing store: ${store.shop_domain} (${store.id})`);

      try {
        // Get decrypted access token for this store
        const tokens = await getDecryptedTokens(store.id);
        
        if (!tokens || !tokens.accessToken) {
          const errorMsg = `No valid access token found for store ${store.shop_domain}`;
          console.error(`❌ ${errorMsg}`);
          allErrors.push(errorMsg);
          continue;
        }

        // Run pricing algorithm for this store
        // The algorithm internally checks the global toggle and will return early if disabled
        const result = await runPricingAlgorithm(
          store.id,
          store.shop_domain,
          tokens.accessToken
        );

        if (!result.success) {
          console.error(`❌ Algorithm encountered errors for store ${store.shop_domain}:`, result.errors);
          allErrors.push(...result.errors.map(err => `[${store.shop_domain}] ${err}`));
        } else {
          console.log(`✅ Store ${store.shop_domain} completed:`, result.stats);
        }

        // Aggregate stats
        totalStats.processed += result.stats.processed;
        totalStats.increased += result.stats.increased;
        totalStats.reverted += result.stats.reverted;
        totalStats.waiting += result.stats.waiting;

      } catch (error) {
        const errorMsg = `Failed to process store ${store.shop_domain}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        allErrors.push(errorMsg);
      }
    }

    const overallSuccess = allErrors.length === 0;
    
    if (overallSuccess) {
      console.log("✅ Pricing algorithm completed successfully for all stores");
    } else {
      console.warn(`⚠️ Pricing algorithm completed with ${allErrors.length} error(s)`);
    }
    
    console.log(`📊 Total Stats: ${JSON.stringify(totalStats, null, 2)}`);

    return {
      success: overallSuccess,
      stats: totalStats,
      errors: allErrors.length > 0 ? allErrors : undefined,
      timestamp: new Date().toISOString(),
      storesProcessed: stores.length,
    };
  },
});

