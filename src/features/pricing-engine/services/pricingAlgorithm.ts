// Simple hill-climbing pricing algorithm - all in one file
import { createAdminClient } from '@/shared/lib/supabase';

export interface AlgorithmResult {
  success: boolean;
  stats: {
    processed: number;
    increased: number;
    reverted: number;
    waiting: number;
  };
  errors: string[];
}

interface ProductRow {
  id: string;
  title: string;
  shopify_id: string;
  starting_price: number;
  current_price: number;
  pricing_config: PricingConfig | PricingConfig[];
}

interface PricingConfig {
  current_state: string;
  auto_pricing_enabled?: boolean;
  increment_percentage?: number;
  period_hours?: number;
  revenue_drop_threshold?: number;
  wait_hours_after_revert?: number;
  max_increase_percentage?: number;
  last_price_change_date?: string;
  revert_wait_until_date?: string;
  next_price_change_date?: string;
  max_price_cap?: number;
  current_price?: number;
  base_price?: number;
  price_change_frequency_hours?: number;
}

interface AlgorithmStats {
  processed: number;
  increased: number;
  reverted: number;
  waiting: number;
}

interface RevenueData {
  [key: string]: unknown;
}

/**
 * Run pricing algorithm for all products with autopilot enabled
 */
export async function runPricingAlgorithm(storeId: string, shopDomain: string, accessToken: string): Promise<AlgorithmResult> {
  const stats = { processed: 0, increased: 0, reverted: 0, waiting: 0 };
  const errors: string[] = [];

  try {
    const supabaseAdmin = createAdminClient();
    // Check if global smart pricing is enabled
    const { data: globalSetting } = await supabaseAdmin
      .from('global_settings')
      .select('value')
      .eq('key', 'smart_pricing_global_enabled')
      .single();

    const globalEnabled = globalSetting?.value === true || globalSetting?.value === 'true';

    if (!globalEnabled) {
      return { 
        success: true, 
        stats, 
        errors: ['Global smart pricing is disabled'] 
      };
    }

    // Get all products with autopilot enabled for this store
    const { data: products } = await supabaseAdmin
      .from('products')
      .select(`*, pricing_config!inner(*)`)
      .eq('store_id', storeId) // NEW AUTH: Filter by store
      .eq('pricing_config.auto_pricing_enabled', true);

    if (!products || products.length === 0) {
      return { success: true, stats, errors: ['No products with autopilot enabled'] };
    }

    // Process each product
    for (const row of products) {
      stats.processed++;
      const config = Array.isArray(row.pricing_config) ? row.pricing_config[0] : row.pricing_config;
      
      try {
        await processProduct(row, config, stats, shopDomain, accessToken, storeId);
      } catch (error) {
        errors.push(`${row.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Log run
    await supabaseAdmin.from('algorithm_runs').insert({
      store_id: storeId, // NEW AUTH: Link to store
      products_processed: stats.processed,
      products_increased: stats.increased,
      products_reverted: stats.reverted,
      products_waiting: stats.waiting,
      execution_time_ms: 0,
      errors: errors.length > 0 ? errors : null,
    });

    return { success: errors.length === 0, stats, errors };
  } catch (error) {
    return {
      success: false,
      stats,
      errors: [error instanceof Error ? error.message : 'Algorithm failed'],
    };
  }
}

/**
 * Process a single product
 */
async function processProduct(product: ProductRow, config: PricingConfig, stats: AlgorithmStats, shopDomain: string, accessToken: string, storeId: string) {
  const now = new Date();

  // Step 1: Check if waiting after revert
  if (config.current_state === 'waiting_after_revert' && config.revert_wait_until_date) {
    if (now < new Date(config.revert_wait_until_date)) {
      stats.waiting++;
      return;
    }
  }

  // Step 2: Check if at max cap
  if (config.current_state === 'at_max_cap') {
    stats.waiting++;
    return;
  }

  // Step 3: Check if enough time passed (using next_price_change_date)
  if (config.next_price_change_date) {
    if (now < new Date(config.next_price_change_date)) {
      stats.waiting++;
      return;
    }
  }

  // Step 4: Get revenue data
  const periodHours = config.period_hours ?? 24;
  const revenue = await getRevenue(product.id, periodHours);

  // Step 5: Decide what to do
  if (!revenue.hasSufficientData) {
    // First increase - no data yet
    await increasePrice(product, config, stats, {} as RevenueData, shopDomain, accessToken, storeId);
  } else if (revenue.changePercent < -(config.revenue_drop_threshold || 1.0)) {
    // Revenue dropped - revert
    await revertPrice(product, config, stats, revenue, shopDomain, accessToken, storeId);
  } else {
    // Revenue stable/up - increase
    await increasePrice(product, config, stats, revenue, shopDomain, accessToken, storeId);
  }
}

/**
 * Get revenue comparison
 */
async function getRevenue(productId: string, periodHours: number) {
  const supabaseAdmin = createAdminClient();
  const now = new Date();
  const currentStart = new Date(now.getTime() - periodHours * 60 * 60 * 1000);
  const previousStart = new Date(currentStart.getTime() - periodHours * 60 * 60 * 1000);

  const { data: currentData } = await supabaseAdmin
    .from('sales_data')
    .select('revenue')
    .eq('product_id', productId)
    .gte('date', currentStart.toISOString().split('T')[0]);

  const { data: previousData } = await supabaseAdmin
    .from('sales_data')
    .select('revenue')
    .eq('product_id', productId)
    .gte('date', previousStart.toISOString().split('T')[0])
    .lt('date', currentStart.toISOString().split('T')[0]);

  const currentRevenue = currentData?.reduce((sum, r) => sum + (r.revenue || 0), 0) || 0;
  const previousRevenue = previousData?.reduce((sum, r) => sum + (r.revenue || 0), 0) || 0;

  const hasSufficientData = currentRevenue > 0 && previousRevenue > 0;
  const changePercent = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

  return { currentRevenue, previousRevenue, changePercent, hasSufficientData };
}

/**
 * Increase price
 */
async function increasePrice(product: ProductRow, config: PricingConfig, stats: AlgorithmStats, revenue: RevenueData | null, shopDomain: string, accessToken: string, storeId: string) {
  const supabaseAdmin = createAdminClient();
  const newPrice = product.current_price * (1 + (config.increment_percentage || 5.0) / 100);
  const percentIncrease = ((newPrice - product.starting_price) / product.starting_price) * 100;

  // Check max cap
  if (percentIncrease > (config.max_increase_percentage || 100.0)) {
    const maxPrice = product.starting_price * (1 + (config.max_increase_percentage || 100.0) / 100);
    await updatePrice(product, config, maxPrice, 'increase', 'Hit max cap', revenue, shopDomain, accessToken, storeId);
    await supabaseAdmin
      .from('pricing_config')
      .update({ current_state: 'at_max_cap' })
      .eq('product_id', product.id);
    stats.increased++;
    return;
  }

  await updatePrice(product, config, newPrice, 'increase', revenue ? `Revenue ${(revenue as Record<string, unknown>).changePercent >= 0 ? 'up' : 'stable'}` : 'First increase', revenue, shopDomain, accessToken, storeId);
  stats.increased++;
}

/**
 * Revert price
 */
async function revertPrice(product: ProductRow, config: PricingConfig, stats: AlgorithmStats, revenue: RevenueData, shopDomain: string, accessToken: string, storeId: string) {
  const supabaseAdmin = createAdminClient();
  
  // Get previous price from history
  const { data: history } = await supabaseAdmin
    .from('pricing_history')
    .select('old_price')
    .eq('product_id', product.id)
    .eq('action', 'increase')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  const previousPrice = history?.old_price || product.starting_price;

  await updatePrice(product, config, previousPrice, 'revert', `Revenue dropped ${(revenue as Record<string, unknown>).changePercent.toFixed(1)}%`, revenue, shopDomain, accessToken, storeId);

  // Set waiting state (updatePrice already set next_price_change_date)
  const waitUntil = new Date();
  waitUntil.setHours(waitUntil.getHours() + (config.wait_hours_after_revert || 24));
  await supabaseAdmin
    .from('pricing_config')
    .update({
      current_state: 'waiting_after_revert',
      revert_wait_until_date: waitUntil.toISOString(),
      next_price_change_date: waitUntil.toISOString(), // Wait until this date
    })
    .eq('product_id', product.id);

  stats.reverted++;
}

/**
 * Update price in Shopify and database
 */
async function updatePrice(product: ProductRow, config: PricingConfig, newPrice: number, action: string, reason: string, revenue: RevenueData | null, shopDomain: string, accessToken: string, storeId: string) {
  const supabaseAdmin = createAdminClient();
  
  // Update Shopify
  await updateShopifyPrice(product.shopify_id, newPrice, shopDomain, accessToken);

  // Update database
  await supabaseAdmin
    .from('products')
    .update({ current_price: newPrice })
    .eq('id', product.id);

  const now = new Date();
  const nextChange = new Date(now.getTime() + (config.period_hours || 24) * 60 * 60 * 1000);
  
  await supabaseAdmin
    .from('pricing_config')
    .update({
      last_price_change_date: now.toISOString(),
      next_price_change_date: nextChange.toISOString(),
      current_state: action === 'revert' ? 'waiting_after_revert' : 'increasing',
    })
    .eq('product_id', product.id);

  // Log to history
  await supabaseAdmin.from('pricing_history').insert({
    product_id: product.id,
    old_price: product.current_price,
    new_price: newPrice,
    action,
    reason,
    revenue_previous_period: revenue?.previousRevenue,
    revenue_current_period: revenue?.currentRevenue,
    revenue_change_percent: revenue?.changePercent,
  });
}

/**
 * Update price in Shopify via API
 */
async function updateShopifyPrice(shopifyId: string, newPrice: number, shopDomain: string, accessToken: string) {
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
  const baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;

  // Get product to find variant ID
  const productRes = await fetch(`${baseUrl}/products/${shopifyId}.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
    cache: 'no-store',
  });

  if (!productRes.ok) throw new Error(`Failed to fetch product: ${productRes.statusText}`);

  const productData = await productRes.json();
  const variantId = productData.product?.variants?.[0]?.id;

  if (!variantId) throw new Error('No variant found');

  // Update variant price
  const updateRes = await fetch(`${baseUrl}/variants/${variantId}.json`, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      variant: { 
        id: variantId, 
        price: newPrice.toFixed(2),
        compare_at_price: null  // Clear "compare at" price to avoid crossed-out effect
      },
    }),
  });

  if (!updateRes.ok) throw new Error(`Failed to update price: ${updateRes.statusText}`);
}

