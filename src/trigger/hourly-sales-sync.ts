import { schedules } from "@trigger.dev/sdk";
import { createAdminClient } from '@/shared/lib/supabase';
import { getDecryptedTokens } from '@/features/shopify-oauth/services/tokenService';

/**
 * Hourly Sales Data Sync Task
 * 
 * Runs every hour to sync sales data from Shopify for all active stores.
 * This ensures the pricing algorithm has up-to-date revenue data for decision making.
 * 
 * The sync process:
 * - Fetches orders from the last 2 hours (with overlap for safety)
 * - Processes order line items into sales_data table
 * - Updates product revenue metrics
 * - Handles multiple stores with their own credentials
 */
export const hourlySalesSync = schedules.task({
  id: "hourly-sales-sync",
  // Run every hour at minute 0
  cron: "0 * * * *",
  run: async (payload) => {
    console.log("🔄 Starting hourly sales data sync...");
    
    const supabase = createAdminClient();
    
    // Get all active stores
    const { data: stores } = await supabase
      .from('stores')
      .select('id, shop_domain')
      .eq('is_active', true);
    
    if (!stores || stores.length === 0) {
      console.log("ℹ️ No active stores found");
      return { success: true, message: 'No active stores found' };
    }
    
    const results = [];
    let totalOrdersProcessed = 0;
    const allErrors: string[] = [];
    
    for (const store of stores) {
      try {
        console.log(`🔄 Syncing sales data for store: ${store.shop_domain}`);
        
        // Get decrypted tokens
        const tokens = await getDecryptedTokens(store.id);
        if (!tokens) {
          const error = `No tokens found for store ${store.shop_domain}`;
          console.error(`❌ ${error}`);
          results.push({ storeId: store.id, success: false, error });
          allErrors.push(error);
          continue;
        }
        
        // Sync last 2 hours of orders (overlap for safety)
        const { syncOrdersFromShopify } = await import(
          '@/features/shopify-integration/services/syncOrders'
        );
        
        const result = await syncOrdersFromShopify(
          store.id,
          store.shop_domain,
          tokens.accessToken,
          0.083 // 2 hours in days
        );
        
        if (result.success) {
          console.log(`✅ Synced ${result.ordersProcessed} orders for ${store.shop_domain}`);
          totalOrdersProcessed += result.ordersProcessed || 0;
        } else {
          console.error(`❌ Failed to sync orders for ${store.shop_domain}: ${result.errors.join(', ')}`);
          allErrors.push(...result.errors);
        }
        
        results.push({
          storeId: store.id,
          shopDomain: store.shop_domain,
          success: result.success,
          ordersProcessed: result.ordersProcessed || 0,
          errors: result.errors
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error syncing store ${store.shop_domain}:`, errorMessage);
        allErrors.push(errorMessage);
        
        results.push({
          storeId: store.id,
          shopDomain: store.shop_domain,
          success: false,
          ordersProcessed: 0,
          error: errorMessage
        });
      }
    }
    
    const success = results.every(r => r.success);
    const message = success 
      ? `Successfully synced ${totalOrdersProcessed} orders across ${stores.length} stores`
      : `Sync completed with errors. ${totalOrdersProcessed} orders processed across ${stores.length} stores`;
    
    console.log(success ? "✅" : "⚠️", message);
    
    return {
      success,
      message,
      totalOrdersProcessed,
      results,
      errors: allErrors,
      timestamp: new Date().toISOString(),
    };
  },
});
