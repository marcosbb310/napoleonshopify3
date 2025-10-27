import { schedules } from "@trigger.dev/sdk";
import { runPricingAlgorithm } from "@/features/pricing-engine/services/pricingAlgorithm";

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
    
    const result = await runPricingAlgorithm();
    
    if (!result.success) {
      console.error("❌ Algorithm encountered errors:", result.errors);
      throw new Error(`Algorithm errors: ${result.errors.join(", ")}`);
    }
    
    console.log("✅ Pricing algorithm completed successfully");
    console.log(`📊 Stats: ${JSON.stringify(result.stats, null, 2)}`);
    
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  },
});

