// Service to sync products from Shopify API to Supabase database
import { createAdminClient } from '@/shared/lib/supabase';

interface ShopifyProduct {
  id: string;
  title: string;
  vendor: string;
  product_type: string;
  variants: Array<{
    id: string;
    price: string;
  }>;
}

interface SyncResult {
  success: boolean;
  synced: number;
  errors: string[];
}

/**
 * Sync products from Shopify to Supabase
 * - Fetches products from Shopify API
 * - Inserts/updates in products table
 * - Initializes pricing_config for new products
 */
export async function syncProductsFromShopify(storeId: string, shopDomain: string, accessToken: string): Promise<SyncResult> {
  const errors: string[] = [];
  let synced = 0;

  try {
    // Fetch products from Shopify
    const shopifyProducts = await fetchShopifyProducts(shopDomain, accessToken);

    // Process each product
    for (const shopifyProduct of shopifyProducts) {
      try {
        await syncSingleProduct(shopifyProduct, storeId);
        synced++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Product ${shopifyProduct.title}: ${message}`);
      }
    }

    return {
      success: errors.length === 0,
      synced,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      synced: 0,
      errors: [`Failed to fetch products: ${message}`],
    };
  }
}

/**
 * Fetch products from Shopify API
 */
async function fetchShopifyProducts(shopDomain: string, accessToken: string): Promise<ShopifyProduct[]> {
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
  const baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;

  const response = await fetch(
    `${baseUrl}/products.json?limit=250`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.products || [];
}

/**
 * Sync a single product to Supabase
 */
async function syncSingleProduct(shopifyProduct: ShopifyProduct, storeId: string): Promise<void> {
  const supabaseAdmin = createAdminClient();
  
  // Get the first variant's price as the current price
  const currentPrice = parseFloat(shopifyProduct.variants[0]?.price || '0');

  // Check if product already exists for this store
  const { data: existingProduct } = await supabaseAdmin
    .from('products')
    .select('id, starting_price')
    .eq('shopify_id', shopifyProduct.id)
    .eq('store_id', storeId) // NEW AUTH: Filter by store
    .single();

  if (existingProduct) {
    // Update existing product (keep starting_price unchanged)
    await supabaseAdmin
      .from('products')
      .update({
        title: shopifyProduct.title,
        vendor: shopifyProduct.vendor,
        product_type: shopifyProduct.product_type,
        current_price: currentPrice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingProduct.id);
  } else {
    // Insert new product
    const { data: newProduct, error: insertError } = await supabaseAdmin
      .from('products')
      .insert({
        store_id: storeId, // NEW AUTH: Link to store
        shopify_id: shopifyProduct.id,
        title: shopifyProduct.title,
        vendor: shopifyProduct.vendor,
        product_type: shopifyProduct.product_type,
        starting_price: currentPrice,
        current_price: currentPrice,
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to insert product: ${insertError.message}`);
    }

    // Initialize pricing_config for new product
    const now = new Date();
    const nextChange = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
    
    await supabaseAdmin
      .from('pricing_config')
      .insert({
        product_id: newProduct.id,
        auto_pricing_enabled: true,
        increment_percentage: 5.0,
        period_hours: 24,
        revenue_drop_threshold: 1.0,
        wait_hours_after_revert: 24, // 1 day in hours (matches period_hours)
        max_increase_percentage: 100.0,
        current_state: 'increasing',
        next_price_change_date: nextChange.toISOString(),
      });
  }
}

