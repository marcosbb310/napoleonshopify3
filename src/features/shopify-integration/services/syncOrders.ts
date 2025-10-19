// Service to sync orders from Shopify API to Supabase sales_data table
import { getSupabaseAdmin } from '@/shared/lib/supabase';

interface ShopifyOrder {
  id: string;
  created_at: string;
  line_items: Array<{
    product_id: string;
    quantity: number;
    price: string;
  }>;
}

interface SyncResult {
  success: boolean;
  ordersProcessed: number;
  salesRecordsCreated: number;
  errors: string[];
}

/**
 * Sync orders from Shopify to Supabase sales_data
 * - Fetches recent orders from Shopify
 * - Groups by product and date
 * - Stores daily sales data
 */
export async function syncOrdersFromShopify(daysBack: number = 90): Promise<SyncResult> {
  const errors: string[] = [];
  let ordersProcessed = 0;
  let salesRecordsCreated = 0;

  try {
    // Fetch orders from Shopify
    const orders = await fetchShopifyOrders(daysBack);
    ordersProcessed = orders.length;

    // Group orders by product and date
    const salesByProductDate = groupSalesByProductDate(orders);

    // Store in sales_data table
    for (const [key, salesData] of salesByProductDate.entries()) {
      try {
        await storeSalesData(salesData);
        salesRecordsCreated++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to store sales for ${key}: ${message}`);
      }
    }

    return {
      success: errors.length === 0,
      ordersProcessed,
      salesRecordsCreated,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      ordersProcessed: 0,
      salesRecordsCreated: 0,
      errors: [`Failed to fetch orders: ${message}`],
    };
  }
}

/**
 * Fetch orders from Shopify API
 */
async function fetchShopifyOrders(daysBack: number): Promise<ShopifyOrder[]> {
  const storeUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || process.env.SHOPIFY_API_VERSION || '2024-10';

  if (!storeUrl || !accessToken) {
    throw new Error('Missing Shopify credentials');
  }

  // Calculate date range
  const createdAtMin = new Date();
  createdAtMin.setDate(createdAtMin.getDate() - daysBack);
  const dateString = createdAtMin.toISOString();

  const baseUrl = `https://${storeUrl}/admin/api/${apiVersion}`;

  const response = await fetch(
    `${baseUrl}/orders.json?status=any&created_at_min=${dateString}&limit=250`,
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
  return data.orders || [];
}

/**
 * Group sales by product and date
 */
function groupSalesByProductDate(orders: ShopifyOrder[]): Map<string, SalesData> {
  const salesMap = new Map<string, SalesData>();

  for (const order of orders) {
    const orderDate = new Date(order.created_at).toISOString().split('T')[0]; // YYYY-MM-DD

    for (const item of order.line_items) {
      const key = `${item.product_id}_${orderDate}`;
      const price = parseFloat(item.price);
      const quantity = item.quantity;
      const revenue = price * quantity;

      if (salesMap.has(key)) {
        const existing = salesMap.get(key)!;
        existing.units_sold += quantity;
        existing.revenue += revenue;
      } else {
        salesMap.set(key, {
          shopify_product_id: item.product_id,
          date: orderDate,
          price_on_date: price,
          units_sold: quantity,
          revenue,
        });
      }
    }
  }

  return salesMap;
}

interface SalesData {
  shopify_product_id: string;
  date: string;
  price_on_date: number;
  units_sold: number;
  revenue: number;
}

/**
 * Store sales data in Supabase
 */
async function storeSalesData(salesData: SalesData): Promise<void> {
  // First, get our internal product_id from shopify_product_id
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('shopify_id', salesData.shopify_product_id)
    .single();

  if (!product) {
    throw new Error(`Product not found for Shopify ID: ${salesData.shopify_product_id}`);
  }

  // Insert or update sales_data
  const { error } = await supabaseAdmin
    .from('sales_data')
    .upsert(
      {
        product_id: product.id,
        date: salesData.date,
        price_on_date: salesData.price_on_date,
        units_sold: salesData.units_sold,
        revenue: salesData.revenue,
        source: 'shopify',
      },
      {
        onConflict: 'product_id,date',
      }
    );

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }
}

