import { createAdminClient } from '@/shared/lib/supabase';

interface ShopifyOrder {
  id: string;
  created_at: string;
  line_items: Array<{
    product_id: string;
    variant_id: string;
    quantity: number;
    price: string;
  }>;
}

export async function processSalesData(orderData: ShopifyOrder, storeId: string) {
  const supabase = createAdminClient();
  const orderDate = new Date(orderData.created_at).toISOString().split('T')[0];
  
  for (const item of orderData.line_items) {
    try {
      // Get internal product_id from shopify_id
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('shopify_id', item.product_id)
        .eq('store_id', storeId)
        .single();
      
      if (!product) continue; // Skip if product not synced yet
      
      const price = parseFloat(item.price);
      const revenue = price * item.quantity;
      
      // Upsert sales data
      const { error } = await supabase
        .from('sales_data')
        .upsert({
          store_id: storeId,
          product_id: product.id,
          date: orderDate,
          price_on_date: price,
          units_sold: item.quantity,
          revenue: revenue,
          source: 'shopify'
        }, {
          onConflict: 'store_id,product_id,date',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error('Failed to upsert sales data:', error);
      }
    } catch (error) {
      console.error('Error processing line item:', error);
    }
  }
}

export async function backfillSalesData(storeId: string, shopDomain: string, accessToken: string, daysBack: number = 90) {
  // Use existing syncOrdersFromShopify service
  const { syncOrdersFromShopify } = await import('@/features/shopify-integration/services/syncOrders');
  return syncOrdersFromShopify(storeId, shopDomain, accessToken, daysBack);
}
