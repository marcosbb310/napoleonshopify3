// Simple hill-climbing pricing algorithm - all in one file
import { getSupabaseAdmin } from '@/shared/lib/supabase';

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

/**
 * Run pricing algorithm for all products with autopilot enabled
 */
export async function runPricingAlgorithm(): Promise<AlgorithmResult> {
  const stats = { processed: 0, increased: 0, reverted: 0, waiting: 0 };
  const errors: string[] = [];

  try {
    const supabaseAdmin = getSupabaseAdmin();
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

    // Get all products with autopilot enabled
    const { data: products } = await supabaseAdmin
      .from('products')
      .select(`*, pricing_config!inner(*)`)
      .eq('pricing_config.auto_pricing_enabled', true);

    if (!products || products.length === 0) {
      return { success: true, stats, errors: ['No products with autopilot enabled'] };
    }

    // Process each product
    for (const row of products) {
      stats.processed++;
      const config = Array.isArray(row.pricing_config) ? row.pricing_config[0] : row.pricing_config;
      
      try {
        await processProduct(row, config, stats, supabaseAdmin);
      } catch (error) {
        errors.push(`${row.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Log run
    await supabaseAdmin.from('algorithm_runs').insert({
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
async function processProduct(product: any, config: any, stats: any, supabaseAdmin: any) {
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
  const revenue = await getRevenue(product.id, config.period_hours);

  // Step 5: Decide what to do
  if (!revenue.hasSufficientData) {
    // First increase - no data yet
    await increasePrice(product, config, stats, null);
  } else if (revenue.changePercent < -config.revenue_drop_threshold) {
    // Revenue dropped - revert
    await revertPrice(product, config, stats, revenue);
  } else {
    // Revenue stable/up - increase
    await increasePrice(product, config, stats, revenue);
  }
}

/**
 * Get revenue comparison
 */
async function getRevenue(productId: string, periodHours: number) {
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
async function increasePrice(product: any, config: any, stats: any, revenue: any) {
  const newPrice = product.current_price * (1 + config.increment_percentage / 100);
  const percentIncrease = ((newPrice - product.starting_price) / product.starting_price) * 100;

  // Check max cap
  if (percentIncrease > config.max_increase_percentage) {
    const maxPrice = product.starting_price * (1 + config.max_increase_percentage / 100);
    await updatePrice(product, config, maxPrice, 'increase', 'Hit max cap', revenue);
    await supabaseAdmin
      .from('pricing_config')
      .update({ current_state: 'at_max_cap' })
      .eq('product_id', product.id);
    stats.increased++;
    return;
  }

  await updatePrice(product, config, newPrice, 'increase', revenue ? `Revenue ${revenue.changePercent >= 0 ? 'up' : 'stable'}` : 'First increase', revenue);
  stats.increased++;
}

/**
 * Revert price
 */
async function revertPrice(product: any, config: any, stats: any, revenue: any) {
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

  await updatePrice(product, config, previousPrice, 'revert', `Revenue dropped ${revenue.changePercent.toFixed(1)}%`, revenue);

  // Set waiting state (updatePrice already set next_price_change_date)
  const waitUntil = new Date();
  waitUntil.setHours(waitUntil.getHours() + config.wait_hours_after_revert);
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
async function updatePrice(product: any, config: any, newPrice: number, action: string, reason: string, revenue: any) {
  // Update Shopify
  await updateShopifyPrice(product.shopify_id, newPrice);

  // Update database
  await supabaseAdmin
    .from('products')
    .update({ current_price: newPrice })
    .eq('id', product.id);

  const now = new Date();
  const nextChange = new Date(now.getTime() + config.period_hours * 60 * 60 * 1000);
  
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
async function updateShopifyPrice(shopifyId: string, newPrice: number) {
  const storeUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';

  if (!storeUrl || !accessToken) throw new Error('Missing Shopify credentials');

  const baseUrl = `https://${storeUrl}/admin/api/${apiVersion}`;

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

