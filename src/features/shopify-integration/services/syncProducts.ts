import { createAdminClient } from '@/shared/lib/supabase';
import { ShopifyClient } from './shopifyClient';

interface SyncResult {
  success: boolean;
  productsCreated: number;
  productsUpdated: number;
  errors: string[];
}

export async function syncProductsFromShopify(
  storeId: string,
  shopDomain: string,
  accessToken: string
): Promise<SyncResult> {
  const errors: string[] = [];
  let productsCreated = 0;
  let productsUpdated = 0;

  try {
    const supabase = createAdminClient();
    
    // Create Shopify client with store-specific credentials
    const client = new ShopifyClient({
      storeUrl: shopDomain,
      accessToken: accessToken,
    });

    // Fetch all products from Shopify
    const response = await client.getProducts();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        productsCreated: 0,
        productsUpdated: 0,
        errors: [response.error?.message || 'Failed to fetch products'],
      };
    }

    const products = response.data;
    console.log(`📦 Syncing ${products.length} products for store ${shopDomain}`);

    // Process each product
    for (const product of products) {
      try {
        // Get first variant price (all products have at least one variant)
        const firstVariant = product.variants[0];
        if (!firstVariant) {
          errors.push(`Product ${product.title} has no variants, skipping`);
          continue;
        }

        const price = parseFloat(firstVariant.price);
        if (isNaN(price) || price < 0) {
          errors.push(`Product ${product.title} has invalid price: ${firstVariant.price}`);
          continue;
        }

        // Check if product already exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('store_id', storeId)
          .eq('shopify_id', product.id)
          .single();

        // Upsert product
        const { error: upsertError } = await supabase
          .from('products')
          .upsert({
            store_id: storeId,
            shopify_id: product.id,
            title: product.title,
            vendor: product.vendor || null,
            product_type: product.productType || null,
            starting_price: price,
            current_price: price,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'store_id,shopify_id',
          });

        if (upsertError) {
          errors.push(`Failed to sync ${product.title}: ${upsertError.message}`);
          continue;
        }

        if (existing) {
          productsUpdated++;
        } else {
          productsCreated++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Error processing ${product.title}: ${message}`);
      }
    }

    console.log(`✅ Sync complete: ${productsCreated} created, ${productsUpdated} updated`);

    return {
      success: errors.length === 0,
      productsCreated,
      productsUpdated,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      productsCreated: 0,
      productsUpdated: 0,
      errors: [message],
    };
  }
}