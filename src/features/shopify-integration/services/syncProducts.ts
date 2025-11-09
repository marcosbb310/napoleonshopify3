import { createAdminClient } from '@/shared/lib/supabase';
import { ShopifyClient } from './shopifyClient';
import { getDecryptedTokens } from '@/features/shopify-oauth/services/tokenService';
import type { ShopifyProduct } from '../types';

export interface SyncResult {
  success: boolean;
  totalProducts: number;
  syncedProducts: number;
  errors: string[];
  duration: number;
}

export interface SyncProgress {
  storeId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  totalProducts: number;
  syncedProducts: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

/**
 * Sync products from Shopify to local database
 * 
 * @param storeId - The store ID in our database
 * @param shopDomain - The Shopify store domain
 * @param accessToken - The Shopify access token
 * @returns Sync result with statistics
 */
export async function syncProductsFromShopify(
  storeId: string,
  shopDomain: string,
  accessToken: string
): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let totalProducts = 0;
  let syncedProducts = 0;

  try {
    console.log('🔄 Starting product sync for store:', storeId);

    // Update sync status to in_progress
    await updateSyncStatus(storeId, 'in_progress', 0, 0);

    // Initialize Shopify client
    const shopifyClient = new ShopifyClient({
      storeUrl: shopDomain,
      accessToken,
    });

    // Fetch all products from Shopify
    const productsResponse = await shopifyClient.getProducts();
    
    if (!productsResponse.success || !productsResponse.data) {
      const errorMessage = productsResponse.error 
        ? (typeof productsResponse.error === 'string' ? productsResponse.error : productsResponse.error.message)
        : 'Failed to fetch products from Shopify';
      throw new Error(errorMessage);
    }

    const shopifyProducts = productsResponse.data;
    totalProducts = shopifyProducts.length;

    console.log(`📦 Found ${totalProducts} products to sync`);

    // Update sync status with total count
    await updateSyncStatus(storeId, 'in_progress', totalProducts, 0);

    // Process products in batches to avoid overwhelming the database
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < shopifyProducts.length; i += batchSize) {
      batches.push(shopifyProducts.slice(i, i + batchSize));
    }

    console.log(`📊 Processing ${batches.length} batches of ${batchSize} products each`);

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      try {
        await processProductBatch(storeId, batch);
        syncedProducts += batch.length;
        
        // Update progress
        await updateSyncStatus(storeId, 'in_progress', totalProducts, syncedProducts);
        
        console.log(`✅ Processed batch ${batchIndex + 1}/${batches.length} (${syncedProducts}/${totalProducts} products)`);
      } catch (error) {
        const errorMsg = `Batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error('❌', errorMsg);
        
        // Continue with next batch
        continue;
      }
    }

    const duration = Date.now() - startTime;

    // Update final sync status
    await updateSyncStatus(storeId, 'completed', totalProducts, syncedProducts);

    console.log(`✅ Product sync completed in ${duration}ms: ${syncedProducts}/${totalProducts} products synced`);

    return {
      success: errors.length === 0,
      totalProducts,
      syncedProducts,
      errors,
      duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('❌ Product sync failed:', errorMessage);
    
    // Update sync status to failed
    await updateSyncStatus(storeId, 'failed', totalProducts, syncedProducts, errorMessage);

    return {
      success: false,
      totalProducts,
      syncedProducts,
      errors: [...errors, errorMessage],
      duration,
    };
  }
}

/**
 * Process a batch of products and store them in the database
 */
async function processProductBatch(storeId: string, products: ShopifyProduct[]): Promise<void> {
  const supabase = createAdminClient();

  // Prepare products for upsert
  const productsToUpsert = products.map(product => ({
    store_id: storeId,
    shopify_id: product.id,
    title: product.title,
    handle: product.handle,
    vendor: product.vendor,
    product_type: product.productType,
    tags: product.tags || [],
    status: product.status,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
    is_active: true,
  }));

  // Upsert products
  const { error: productsError } = await supabase
    .from('products')
    .upsert(productsToUpsert, {
      onConflict: 'store_id,shopify_id',
      ignoreDuplicates: false,
    });

  if (productsError) {
    throw new Error(`Failed to upsert products: ${productsError.message}`);
  }

  // Process variants for each product
  // CRITICAL: Every Shopify product has at least one variant
  // Every priced item = one variant entity (simple model)
  for (const product of products) {
    if (!product.variants || product.variants.length === 0) {
      console.warn(`⚠️ Product ${product.id} (${product.title}) has no variants - skipping`);
      continue;
    }

    // First, get the internal database ID for this product
    const { data: dbProduct } = await supabase
      .from('products')
      .select('id')
      .eq('store_id', storeId)
      .eq('shopify_id', product.id)
      .single();
    
    if (dbProduct) {
      // Use the internal database UUID
      // Process ALL variants - each one is an independent priced entity
      await processProductVariants(storeId, dbProduct.id, product.variants, product.id);
    } else {
      console.error(`❌ Could not find internal ID for product with shopify_id: ${product.id}`);
    }
  }
}

/**
 * Process and store product variants
 */
async function processProductVariants(
  storeId: string,
  productDbId: string,  // Internal database UUID
  variants: ShopifyProduct['variants'],
  shopifyProductId: string  // Shopify product ID for logging
): Promise<void> {
  const supabase = createAdminClient();
  
  console.log(`🔄 Processing variants for product shopify_id: ${shopifyProductId}, db_id: ${productDbId}`);

  // CRITICAL: Query existing variants with their pricing_config to check smart pricing status
  // This prevents sync from overwriting prices when smart pricing is disabled
  const { data: existingVariants } = await supabase
    .from('product_variants')
    .select(`
      id,
      shopify_id,
      current_price,
      pricing_config(
        id,
        auto_pricing_enabled,
        pre_smart_pricing_price,
        last_smart_pricing_price
      )
    `)
    .eq('product_id', productDbId)
    .in('shopify_id', variants.map(v => v.id));

  // Create a Map to track which variants have smart pricing disabled
  const smartPricingDisabled = new Map<string, boolean>();
  existingVariants?.forEach((v: any) => {
    const config = Array.isArray(v.pricing_config) 
      ? v.pricing_config[0] 
      : v.pricing_config;
    const isDisabled = config?.auto_pricing_enabled === false;
    smartPricingDisabled.set(v.shopify_id, isDisabled);
    
    if (isDisabled) {
      console.log(`⚠️ Variant ${v.shopify_id} has smart pricing disabled - preserving database current_price during sync`);
    }
  });

  // Prepare variants for upsert
  const variantPriceByShopifyId = new Map<string, number>();

  const variantsToUpsert = variants.map(variant => {
    const priceDecimal = parseFloat(variant.price);
    const normalizedPrice = Number.isFinite(priceDecimal) ? priceDecimal : 0;
    variantPriceByShopifyId.set(variant.id, normalizedPrice);

    const isSmartPricingDisabled = smartPricingDisabled.get(variant.id) === true;
    
    // Base data that's always synced
    const baseData = {
      store_id: storeId,
      product_id: productDbId,  // Use internal database UUID
      shopify_id: variant.id,
      shopify_product_id: shopifyProductId,
      title: variant.title,
      price: variant.price.toString(),
      starting_price: normalizedPrice,
      // CRITICAL: Only sync current_price if smart pricing is enabled
      // When disabled, preserve the database value (which should be pre_smart_pricing_price)
      ...(isSmartPricingDisabled ? {} : { current_price: normalizedPrice }),
      compare_at_price: variant.compareAtPrice?.toString() || null,
      sku: variant.sku || null,
      inventory_quantity: variant.inventoryQuantity || 0,
      weight: variant.weight || 0,
      weight_unit: variant.weightUnit || 'kg',
      image_url: variant.image?.src || null,
      created_at: variant.createdAt,
      updated_at: variant.updatedAt,
      is_active: true,
    };
    
    return baseData;
  });

  // Upsert variants
  const { data: upsertedVariants, error: variantsError } = await supabase
    .from('product_variants')
    .upsert(variantsToUpsert, {
      onConflict: 'store_id,product_id,shopify_id',
      ignoreDuplicates: false,
    })
    .select('id, shopify_id, shopify_product_id, starting_price, current_price');

  if (variantsError) {
    throw new Error(`Failed to upsert variants: ${variantsError.message}`);
  }

  if (upsertedVariants?.some((variant) => !variant.shopify_product_id)) {
    console.warn(
      '⚠️ SyncProducts: Missing shopify_product_id after upsert. Check schema migration.',
      {
        storeId,
        productDbId,
        shopifyProductId,
      }
    );
  }

  if (upsertedVariants && upsertedVariants.length > 0) {
    const variantIds = upsertedVariants.map((variant) => variant.id);

    const { data: existingConfigs, error: configsFetchError } = await supabase
      .from('pricing_config')
      .select('variant_id')
      .in('variant_id', variantIds);

    if (configsFetchError) {
      throw new Error(`Failed to fetch pricing configs: ${configsFetchError.message}`);
    }

    const configVariantIds = new Set(
      (existingConfigs || []).map((config) => config.variant_id)
    );

    const configsToInsert = upsertedVariants
      .filter((variant) => !configVariantIds.has(variant.id))
      .map((variant) => {
        const baseline =
          variant.current_price ??
          variant.starting_price ??
          variantPriceByShopifyId.get(variant.shopify_id) ??
          0;

        return {
          variant_id: variant.id,
          auto_pricing_enabled: false,
          pre_smart_pricing_price: baseline,
          last_smart_pricing_price: null,
          current_state: 'increasing',
          next_price_change_date: null,
          revert_wait_until_date: null,
        };
      });

    if (configsToInsert.length > 0) {
      const { error: insertConfigError } = await supabase
        .from('pricing_config')
        .insert(configsToInsert);

      if (insertConfigError) {
        throw new Error(
          `Failed to insert default pricing configs: ${insertConfigError.message}`
        );
      }
    }
  }
}

/**
 * Update sync status in the database
 */
async function updateSyncStatus(
  storeId: string,
  status: SyncProgress['status'],
  totalProducts: number,
  syncedProducts: number,
  errorMessage?: string
): Promise<void> {
  const supabase = createAdminClient();

  const now = new Date().toISOString();
  const updateData: any = {
    store_id: storeId,
    sync_type: 'products',
    status,
    total_products: totalProducts,
    products_synced: syncedProducts,
    started_at: now,
  };

  if (status === 'completed' || status === 'failed') {
    updateData.completed_at = now;
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { error } = await supabase
    .from('sync_status')
    .upsert(updateData, {
      onConflict: 'store_id,sync_type',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Failed to update sync status:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Get current sync status for a store
 */
export async function getSyncStatus(storeId: string): Promise<SyncProgress | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('sync_status')
    .select('*')
    .eq('store_id', storeId)
    .eq('sync_type', 'products')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    storeId: data.store_id,
    status: data.status,
    totalProducts: data.total_products || 0,
    syncedProducts: data.products_synced || 0,
    startedAt: data.started_at,
    completedAt: data.completed_at || undefined,
    errorMessage: data.error_message || undefined,
  };
}

/**
 * Clean up old sync status records (keep last 10 per store)
 */
export async function cleanupSyncStatus(): Promise<void> {
  const supabase = createAdminClient();

  // This would need a more complex query to keep only the last 10 records per store
  // For now, we'll just delete records older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { error } = await supabase
    .from('sync_status')
    .delete()
    .lt('started_at', thirtyDaysAgo.toISOString());

  if (error) {
    console.error('Failed to cleanup sync status:', error);
  }
}