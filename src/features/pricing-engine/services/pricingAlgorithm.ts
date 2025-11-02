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

interface VariantRow {
  id: string;
  title: string;
  shopify_id: string;
  starting_price: number;
  current_price: number;
  product_id: string;  // Track parent product
  store_id: string;    // Track store for Shopify updates
  pricing_config: PricingConfig | PricingConfig[];
}

interface ProductRow {
  id: string;
  title: string;
  shopify_id: string;
  starting_price: number;
  current_price: number;
  store_id: string;
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
  console.log('🔵 PRICING ALGORITHM: Starting for store:', storeId, shopDomain);
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
    console.log('🔵 PRICING ALGORITHM: Global enabled:', globalEnabled);

    if (!globalEnabled) {
      console.log('🔵 PRICING ALGORITHM: Skipping - global disabled');
      return { 
        success: true, 
        stats, 
        errors: ['Global smart pricing is disabled'] 
      };
    }

    // Get all variants for this store - we'll filter by config later
    const { data: allVariants } = await supabaseAdmin
      .from('product_variants')
      .select(`*, pricing_config(*)`)
      .eq('store_id', storeId)
      .eq('is_active', true);

    console.log('🔵 PRICING ALGORITHM: Found variants:', allVariants?.length || 0);

    if (!allVariants || allVariants.length === 0) {
      console.log('🔵 PRICING ALGORITHM: No variants found');
      return { success: true, stats, errors: ['No variants found for this store'] };
    }

    // Filter variants with auto_pricing_enabled OR create configs for variants without them
    const variantsToProcess: Array<{ variant: VariantRow; config: PricingConfig }> = [];

    for (const variant of allVariants) {
      let config = Array.isArray(variant.pricing_config) 
        ? variant.pricing_config[0] 
        : variant.pricing_config;

      // If no config exists AND global is enabled, create one with auto_pricing_enabled = true
      // (This handles newly synced variants)
      if (!config && globalEnabled) {
        const { data: newConfig, error: createError } = await supabaseAdmin
          .from('pricing_config')
          .insert({
            variant_id: variant.id,
            auto_pricing_enabled: true, // Auto-enable since global is on
            current_state: 'increasing',
            increment_percentage: 5.0,
            period_hours: 24,
            revenue_drop_threshold: 1.0,
            wait_hours_after_revert: 24,
            max_increase_percentage: 100.0,
            pre_smart_pricing_price: variant.current_price || variant.starting_price,
            base_price: variant.current_price || variant.starting_price,
          })
          .select()
          .single();

        if (createError) {
          errors.push(`${variant.title}: Failed to create pricing config - ${createError.message}`);
          continue;
        }

        config = newConfig as PricingConfig;
      }

      // Only process if config exists and auto_pricing_enabled is true
      if (config && config.auto_pricing_enabled) {
        variantsToProcess.push({ variant: variant as VariantRow, config });
      }
    }

    console.log('🔵 PRICING ALGORITHM: Variants to process:', variantsToProcess.length);

    if (variantsToProcess.length === 0) {
      console.log('🔵 PRICING ALGORITHM: No variants with autopilot enabled');
      return { success: true, stats, errors: ['No variants with autopilot enabled'] };
    }

    // Process each variant
    for (const { variant, config } of variantsToProcess) {
      stats.processed++;
      console.log(`🔵 PRICING ALGORITHM: Processing variant ${stats.processed}/${variantsToProcess.length}:`, variant.title);
      
      try {
        await processVariant(variant, config, stats, shopDomain, accessToken, storeId);
      } catch (error) {
        const errorMsg = `${variant.title}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('🔵 PRICING ALGORITHM: Error processing variant:', errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log('🔵 PRICING ALGORITHM: Completed processing:', {
      processed: stats.processed,
      increased: stats.increased,
      reverted: stats.reverted,
      waiting: stats.waiting,
      errors: errors.length
    });

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
 * Process a single variant
 */
async function processVariant(variant: VariantRow, config: PricingConfig, stats: AlgorithmStats, shopDomain: string, accessToken: string, storeId: string) {
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
  const revenue = await getRevenue(variant.id, periodHours);

  // Step 5: Decide what to do
  if (!revenue.hasSufficientData) {
    // First increase - no data yet
    await increasePrice(variant, config, stats, {} as RevenueData, shopDomain, accessToken, storeId);
  } else if (revenue.changePercent < -(config.revenue_drop_threshold || 1.0)) {
    // Revenue dropped - revert
    await revertPrice(variant, config, stats, revenue, shopDomain, accessToken, storeId);
  } else {
    // Revenue stable/up - increase
    await increasePrice(variant, config, stats, revenue, shopDomain, accessToken, storeId);
  }
}

/**
 * Get revenue comparison
 */
async function getRevenue(variantId: string, periodHours: number) {
  const supabaseAdmin = createAdminClient();
  const now = new Date();
  const currentStart = new Date(now.getTime() - periodHours * 60 * 60 * 1000);
  const previousStart = new Date(currentStart.getTime() - periodHours * 60 * 60 * 1000);

  const { data: currentData } = await supabaseAdmin
    .from('sales_data')
    .select('revenue')
    .eq('variant_id', variantId)
    .gte('date', currentStart.toISOString().split('T')[0]);

  const { data: previousData } = await supabaseAdmin
    .from('sales_data')
    .select('revenue')
    .eq('variant_id', variantId)
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
async function increasePrice(variant: VariantRow, config: PricingConfig, stats: AlgorithmStats, revenue: RevenueData | null, shopDomain: string, accessToken: string, storeId: string) {
  const supabaseAdmin = createAdminClient();
  const newPrice = variant.current_price * (1 + (config.increment_percentage || 5.0) / 100);
  const percentIncrease = ((newPrice - variant.starting_price) / variant.starting_price) * 100;

  // Check max cap
  if (percentIncrease > (config.max_increase_percentage || 100.0)) {
    const maxPrice = variant.starting_price * (1 + (config.max_increase_percentage || 100.0) / 100);
    await updatePrice(variant, config, maxPrice, 'increase', 'Hit max cap', revenue, shopDomain, accessToken, storeId);
    await supabaseAdmin
      .from('pricing_config')
      .update({ current_state: 'at_max_cap' })
      .eq('variant_id', variant.id);
    stats.increased++;
    return;
  }

  await updatePrice(variant, config, newPrice, 'increase', revenue ? `Revenue ${(revenue as Record<string, unknown>).changePercent >= 0 ? 'up' : 'stable'}` : 'First increase', revenue, shopDomain, accessToken, storeId);
  stats.increased++;
}

/**
 * Revert price
 */
async function revertPrice(variant: VariantRow, config: PricingConfig, stats: AlgorithmStats, revenue: RevenueData, shopDomain: string, accessToken: string, storeId: string) {
  const supabaseAdmin = createAdminClient();
  
  // Get previous price from history
  const { data: history } = await supabaseAdmin
    .from('pricing_history')
    .select('old_price')
    .eq('variant_id', variant.id)
    .eq('action', 'increase')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  const previousPrice = history?.old_price || variant.starting_price;

  await updatePrice(variant, config, previousPrice, 'revert', `Revenue dropped ${(revenue as Record<string, unknown>).changePercent.toFixed(1)}%`, revenue, shopDomain, accessToken, storeId);

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
    .eq('variant_id', variant.id);

  stats.reverted++;
}

/**
 * Update price in Shopify and database
 */
async function updatePrice(variant: VariantRow, config: PricingConfig, newPrice: number, action: string, reason: string, revenue: RevenueData | null, shopDomain: string, accessToken: string, storeId: string) {
  const supabaseAdmin = createAdminClient();
  
  // Update Shopify
  await updateShopifyPrice(variant.shopify_id, newPrice, shopDomain, accessToken);

  // Update database
  await supabaseAdmin
    .from('product_variants')
    .update({ current_price: newPrice })
    .eq('id', variant.id);

  const now = new Date();
  const nextChange = new Date(now.getTime() + (config.period_hours || 24) * 60 * 60 * 1000);
  
  await supabaseAdmin
    .from('pricing_config')
    .update({
      last_price_change_date: now.toISOString(),
      next_price_change_date: nextChange.toISOString(),
      current_state: action === 'revert' ? 'waiting_after_revert' : 'increasing',
      last_smart_pricing_price: variant.current_price,  // Save OLD price before increase
    })
    .eq('variant_id', variant.id);

  // Log to history
  await supabaseAdmin.from('pricing_history').insert({
    variant_id: variant.id,
    product_id: variant.product_id,
    old_price: variant.current_price,
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
  console.log('🔵 UPDATE SHOPIFY: Starting for product:', shopifyId, 'new price:', newPrice);
  
  // Validate inputs
  if (!shopifyId || shopifyId.trim() === '') {
    throw new Error(`Invalid shopify_id: ${shopifyId}`);
  }

  // Ensure shopify_id is numeric (Shopify REST API requires numeric IDs)
  const numericId = shopifyId.replace(/\D/g, ''); // Remove non-numeric characters
  if (!numericId || numericId !== shopifyId) {
    console.warn(`⚠️ Shopiy ID "${shopifyId}" was sanitized to "${numericId}" - check if ID format is correct`);
  }

  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
  const baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;
  const productUrl = `${baseUrl}/products/${numericId}.json`;

  console.log('🔵 UPDATE SHOPIFY: Fetching product from:', productUrl);
  
  // Get product to find variant ID
  const productRes = await fetch(productUrl, {
    headers: { 'X-Shopify-Access-Token': accessToken },
    cache: 'no-store',
  });
  
  console.log('🔵 UPDATE SHOPIFY: Product fetch status:', productRes.status);

  let productData: { product?: { variants?: Array<{ id: string }> } };

  if (!productRes.ok) {
    // Try to get detailed error from Shopify
    let errorMessage = `Failed to fetch product (${productRes.status} ${productRes.statusText})`;
    try {
      const errorText = await productRes.text();
      if (errorText) {
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.errors) {
            errorMessage = typeof errorData.errors === 'string' 
              ? errorData.errors 
              : JSON.stringify(errorData.errors);
          }
        } catch {
          // Not JSON, use raw text
          errorMessage = errorText.substring(0, 200); // Limit length
        }
      }
    } catch {
      // If all else fails, use status text
    }
    
    console.error(`❌ Shopify API error for product ${numericId}:`, {
      status: productRes.status,
      statusText: productRes.statusText,
      url: productUrl,
      shopDomain,
      originalShopifyId: shopifyId,
      numericId,
      errorMessage,
    });

    throw new Error(errorMessage);
  } else {
    productData = await productRes.json();
  }
  const variantId = productData.product?.variants?.[0]?.id;
  console.log('🔵 UPDATE SHOPIFY: Found variant ID:', variantId);

  if (!variantId) {
    console.error('🔵 UPDATE SHOPIFY: No variant found');
    throw new Error(`No variant found for product ${numericId}`);
  }

  console.log('🔵 UPDATE SHOPIFY: Updating variant price to:', newPrice.toFixed(2));
  
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

  console.log('🔵 UPDATE SHOPIFY: Update response status:', updateRes.status);

  if (!updateRes.ok) {
    let errorMessage = `Failed to update price (${updateRes.status} ${updateRes.statusText})`;
    try {
      const errorData = await updateRes.json();
      if (errorData.errors) {
        errorMessage = typeof errorData.errors === 'string'
          ? errorData.errors
          : JSON.stringify(errorData.errors);
      }
    } catch {
      // Ignore JSON parse errors
    }
    console.error('🔵 UPDATE SHOPIFY: Update failed:', errorMessage);
    throw new Error(errorMessage);
  }
  
  console.log('🔵 UPDATE SHOPIFY: Successfully updated price for product:', shopifyId);
}

