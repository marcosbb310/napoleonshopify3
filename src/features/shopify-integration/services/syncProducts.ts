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
      storeUrl: `https://${shopDomain}`,
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
  for (const product of products) {
    if (product.variants && product.variants.length > 0) {
      await processProductVariants(storeId, product.id, product.variants);
    }
  }
}

/**
 * Process and store product variants
 */
async function processProductVariants(
  storeId: string,
  productId: string,
  variants: ShopifyProduct['variants']
): Promise<void> {
  const supabase = createAdminClient();

  // Prepare variants for upsert
  const variantsToUpsert = variants.map(variant => ({
    store_id: storeId,
    product_id: productId,
    shopify_id: variant.id,
    title: variant.title,
    price: variant.price.toString(),
    compare_at_price: variant.compareAtPrice?.toString() || null,
    sku: variant.sku || null,
    inventory_quantity: variant.inventoryQuantity || 0,
    weight: variant.weight || 0,
    weight_unit: variant.weightUnit || 'kg',
    image_url: variant.image?.src || null,
    created_at: variant.createdAt,
    updated_at: variant.updatedAt,
    is_active: true,
  }));

  // Upsert variants
  const { error: variantsError } = await supabase
    .from('product_variants')
    .upsert(variantsToUpsert, {
      onConflict: 'store_id,product_id,shopify_id',
      ignoreDuplicates: false,
    });

  if (variantsError) {
    throw new Error(`Failed to upsert variants: ${variantsError.message}`);
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