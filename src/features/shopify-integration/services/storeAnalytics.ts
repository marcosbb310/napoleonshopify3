import { createAdminClient } from '@/shared/lib/supabase';
import { ShopifyClient } from './shopifyClient';
import { getDecryptedTokens } from '../../shopify-oauth/services/tokenService';
import type { StoreAnalytics, DateRange } from '../hooks/useStoreData';

export interface ShopifyOrder {
  id: number;
  order_number: number;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: 'pending' | 'authorized' | 'partially_paid' | 'paid' | 'partially_refunded' | 'refunded' | 'voided';
  fulfillment_status: 'fulfilled' | 'null' | 'partial' | 'restocked';
  created_at: string;
  updated_at: string;
  processed_at: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  };
  line_items: Array<{
    id: number;
    product_id: number;
    variant_id: number;
    title: string;
    variant_title: string;
    quantity: number;
    price: string;
    total_discount: string;
  }>;
}

export interface ShopifyAnalyticsResponse {
  success: boolean;
  data?: StoreAnalytics;
  error?: string;
}

/**
 * Fetch comprehensive store analytics from Shopify
 * 
 * @param storeId - The store ID in our database
 * @param shopDomain - The Shopify store domain
 * @param accessToken - The Shopify access token
 * @param dateRange - Optional date range for analytics
 * @returns Store analytics data
 */
export async function fetchStoreAnalytics(
  storeId: string,
  shopDomain: string,
  accessToken: string,
  dateRange?: DateRange
): Promise<ShopifyAnalyticsResponse> {
  try {
    console.log('📊 Fetching store analytics for store:', storeId);

    // Initialize Shopify client
    const shopifyClient = new ShopifyClient({
      storeUrl: `https://${shopDomain}`,
      accessToken,
    });

    // Fetch orders from Shopify
    const orders = await fetchOrdersFromShopify(shopifyClient, dateRange);
    
    // Fetch products from Shopify
    const productsResponse = await shopifyClient.getProducts();
    const products = productsResponse.success ? productsResponse.data || [] : [];

    // Calculate analytics
    const analytics = calculateAnalytics(orders, products, dateRange);

    // Store analytics in local database for caching
    await storeAnalyticsInDatabase(storeId, analytics);

    console.log('✅ Store analytics fetched successfully');

    return {
      success: true,
      data: analytics,
    };

  } catch (error) {
    console.error('❌ Failed to fetch store analytics:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch orders from Shopify API
 */
async function fetchOrdersFromShopify(
  shopifyClient: ShopifyClient,
  dateRange?: DateRange
): Promise<ShopifyOrder[]> {
  const orders: ShopifyOrder[] = [];
  let pageInfo: string | null = null;
  const limit = 250; // Shopify's max limit

  try {
    do {
      const url = new URL(`https://${shopifyClient['baseUrl']}/admin/api/2024-10/orders.json`);
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('status', 'any');
      url.searchParams.set('financial_status', 'paid');
      
      if (dateRange) {
        url.searchParams.set('created_at_min', dateRange.start.toISOString());
        url.searchParams.set('created_at_max', dateRange.end.toISOString());
      }

      if (pageInfo) {
        url.searchParams.set('page_info', pageInfo);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'X-Shopify-Access-Token': shopifyClient['accessToken'],
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      orders.push(...(data.orders || []));

      // Check for pagination
      const linkHeader = response.headers.get('Link');
      pageInfo = extractPageInfo(linkHeader);

    } while (pageInfo);

    console.log(`📦 Fetched ${orders.length} orders from Shopify`);
    return orders;

  } catch (error) {
    console.error('❌ Failed to fetch orders from Shopify:', error);
    throw error;
  }
}

/**
 * Calculate analytics from orders and products data
 */
function calculateAnalytics(
  orders: ShopifyOrder[],
  products: any[],
  dateRange?: DateRange
): StoreAnalytics {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Calculate revenue metrics
  const revenue = calculateRevenueMetrics(orders, {
    today,
    thisWeekStart,
    thisMonthStart,
    lastMonthStart,
    lastMonthEnd,
  });

  // Calculate sales metrics
  const sales = calculateSalesMetrics(orders, {
    today,
    thisWeekStart,
    thisMonthStart,
    lastMonthStart,
    lastMonthEnd,
  });

  // Calculate product metrics
  const productMetrics = calculateProductMetrics(products);

  // Calculate order metrics
  const orderMetrics = calculateOrderMetrics(orders);

  // Calculate top products
  const topProducts = calculateTopProducts(orders);

  // Generate recent activity
  const recentActivity = generateRecentActivity(orders);

  return {
    revenue,
    sales,
    products: productMetrics,
    orders: orderMetrics,
    topProducts,
    recentActivity,
  };
}

function calculateRevenueMetrics(
  orders: ShopifyOrder[],
  dates: {
    today: Date;
    thisWeekStart: Date;
    thisMonthStart: Date;
    lastMonthStart: Date;
    lastMonthEnd: Date;
  }
) {
  const today = orders.filter(order => 
    new Date(order.created_at) >= dates.today
  ).reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0);

  const thisWeek = orders.filter(order => 
    new Date(order.created_at) >= dates.thisWeekStart
  ).reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0);

  const thisMonth = orders.filter(order => 
    new Date(order.created_at) >= dates.thisMonthStart
  ).reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0);

  const lastMonth = orders.filter(order => {
    const orderDate = new Date(order.created_at);
    return orderDate >= dates.lastMonthStart && orderDate <= dates.lastMonthEnd;
  }).reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0);

  const total = orders.reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0);

  const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  return {
    total: Math.round(total * 100) / 100,
    today: Math.round(today * 100) / 100,
    thisWeek: Math.round(thisWeek * 100) / 100,
    thisMonth: Math.round(thisMonth * 100) / 100,
    lastMonth: Math.round(lastMonth * 100) / 100,
    growth: Math.round(growth * 100) / 100,
  };
}

function calculateSalesMetrics(
  orders: ShopifyOrder[],
  dates: {
    today: Date;
    thisWeekStart: Date;
    thisMonthStart: Date;
    lastMonthStart: Date;
    lastMonthEnd: Date;
  }
) {
  const today = orders.filter(order => 
    new Date(order.created_at) >= dates.today
  ).length;

  const thisWeek = orders.filter(order => 
    new Date(order.created_at) >= dates.thisWeekStart
  ).length;

  const thisMonth = orders.filter(order => 
    new Date(order.created_at) >= dates.thisMonthStart
  ).length;

  const lastMonth = orders.filter(order => {
    const orderDate = new Date(order.created_at);
    return orderDate >= dates.lastMonthStart && orderDate <= dates.lastMonthEnd;
  }).length;

  const total = orders.length;

  const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  return {
    total,
    today,
    thisWeek,
    thisMonth,
    lastMonth,
    growth: Math.round(growth * 100) / 100,
  };
}

function calculateProductMetrics(products: any[]) {
  const statusCounts = products.reduce((acc, product) => {
    acc[product.status] = (acc[product.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total: products.length,
    active: statusCounts.active || 0,
    draft: statusCounts.draft || 0,
    archived: statusCounts.archived || 0,
  };
}

function calculateOrderMetrics(orders: ShopifyOrder[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayOrders = orders.filter(order => 
    new Date(order.created_at) >= today
  ).length;

  const thisWeekOrders = orders.filter(order => 
    new Date(order.created_at) >= thisWeekStart
  ).length;

  const thisMonthOrders = orders.filter(order => 
    new Date(order.created_at) >= thisMonthStart
  ).length;

  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0);
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  return {
    total: orders.length,
    today: todayOrders,
    thisWeek: thisWeekOrders,
    thisMonth: thisMonthOrders,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
  };
}

function calculateTopProducts(orders: ShopifyOrder[]) {
  const productSales = new Map<string, { title: string; revenue: number; sales: number }>();

  orders.forEach(order => {
    order.line_items.forEach(item => {
      const key = `${item.product_id}-${item.variant_id}`;
      const existing = productSales.get(key) || { title: item.title, revenue: 0, sales: 0 };
      
      existing.revenue += parseFloat(item.price) * item.quantity;
      existing.sales += item.quantity;
      
      productSales.set(key, existing);
    });
  });

  return Array.from(productSales.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((product, index) => ({
      id: `product_${index}`,
      title: product.title,
      revenue: Math.round(product.revenue * 100) / 100,
      sales: product.sales,
      growth: 0, // Would need historical data to calculate
    }));
}

function generateRecentActivity(orders: ShopifyOrder[]) {
  const activities = orders
    .slice(0, 10) // Last 10 orders
    .map(order => ({
      id: `order_${order.id}`,
      type: 'order_placed' as const,
      description: `New order #${order.order_number} for $${parseFloat(order.total_price).toFixed(2)}`,
      timestamp: order.created_at,
      metadata: {
        orderId: order.id,
        orderNumber: order.order_number,
        totalPrice: order.total_price,
        customerEmail: order.customer.email,
      },
    }));

  return activities;
}

/**
 * Store analytics in database for caching
 */
async function storeAnalyticsInDatabase(storeId: string, analytics: StoreAnalytics): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('store_analytics')
    .upsert({
      store_id: storeId,
      analytics_data: analytics,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'store_id',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Failed to store analytics in database:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Extract page info from Link header for pagination
 */
function extractPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const links = linkHeader.split(',');
  for (const link of links) {
    if (link.includes('rel="next"')) {
      const match = link.match(/<([^>]+)>/);
      if (match) {
        const url = new URL(match[1]);
        return url.searchParams.get('page_info');
      }
    }
  }

  return null;
}
