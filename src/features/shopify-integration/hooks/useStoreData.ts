'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/shared/lib/supabase';

export interface StoreAnalytics {
  revenue: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    lastMonth: number;
    growth: number; // percentage
  };
  sales: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    lastMonth: number;
    growth: number; // percentage
  };
  products: {
    total: number;
    active: number;
    draft: number;
    archived: number;
  };
  orders: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    averageOrderValue: number;
  };
  topProducts: Array<{
    id: string;
    title: string;
    revenue: number;
    sales: number;
    growth: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'price_change' | 'product_added' | 'order_placed' | 'sync_completed';
    description: string;
    timestamp: string;
    metadata?: Record<string, any>;
  }>;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export function useStoreData(storeId?: string, dateRange?: DateRange) {
  const supabase = createClient();

  // Get current user for query key
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
    staleTime: 5 * 60 * 1000,
  });

  const user = session?.user;

  // Fetch store analytics
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['store-analytics', storeId, dateRange],
    queryFn: async (): Promise<StoreAnalytics> => {
      if (!storeId) {
        console.log('❌ No store ID provided');
        return getEmptyAnalytics();
      }

      console.log('🔍 Fetching store analytics for store:', storeId);

      // Get date ranges
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Fetch revenue data from orders table
      // Note: orders table doesn't exist yet, so we'll use empty data for now
      let revenueData: any[] = [];
      let revenueError = null;
      
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('total_price, created_at')
          .eq('store_id', storeId)
          .eq('financial_status', 'paid');
        
        if (error) {
          // Check if table doesn't exist (PGRST116) or if it's a permissions issue (42P01)
          const isTableNotFound = error.code === 'PGRST116' || error.code === '42P01';
          
          if (isTableNotFound) {
            console.warn('⚠️ Orders table not found, using empty revenue data');
          } else {
            console.error('❌ Failed to fetch revenue data:', error);
          }
          revenueError = error;
        } else {
          revenueData = data || [];
        }
      } catch (error) {
        console.warn('⚠️ Error accessing orders table:', error);
        revenueError = error;
      }

      // Calculate revenue metrics
      const revenue = calculateRevenueMetrics(revenueData || [], {
        today,
        thisWeekStart,
        thisMonthStart,
        lastMonthStart,
        lastMonthEnd,
      });

      // Fetch sales data (order count)
      // Note: orders table doesn't exist yet, so we'll use empty data for now
      let salesData: any[] = [];
      let salesError = null;
      
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, created_at')
          .eq('store_id', storeId)
          .eq('financial_status', 'paid');
        
        if (error) {
          // Check if table doesn't exist (PGRST116) or if it's a permissions issue (42P01)
          const isTableNotFound = error.code === 'PGRST116' || error.code === '42P01';
          
          if (isTableNotFound) {
            console.warn('⚠️ Orders table not found, using empty sales data');
          } else {
            console.error('❌ Failed to fetch sales data:', error);
          }
          salesError = error;
        } else {
          salesData = data || [];
        }
      } catch (error) {
        console.warn('⚠️ Error accessing orders table:', error);
        salesError = error;
      }

      // Calculate sales metrics
      const sales = calculateSalesMetrics(salesData || [], {
        today,
        thisWeekStart,
        thisMonthStart,
        lastMonthStart,
        lastMonthEnd,
      });

      // Fetch product counts
      // Note: using the products table which exists
      let productData: any[] = [];
      let productError = null;
      
      try {
        const { data, error } = await supabase
          .from('products')
          .select('title, current_price')
          .eq('shopify_id', storeId); // Note: adapting to existing schema
        
        if (error) {
          console.error('❌ Failed to fetch product data:', error);
          productError = error;
        } else {
          productData = data || [];
        }
      } catch (error) {
        console.warn('⚠️ Error fetching products:', error);
        productError = error;
      }

      const products = calculateProductMetrics(productData || []);

      // Fetch order metrics
      const orders = calculateOrderMetrics(salesData || [], revenueData || []);

      // Fetch top products (mock for now - would need more complex queries)
      const topProducts = await fetchTopProducts(storeId, supabase);

      // Fetch recent activity
      const recentActivity = await fetchRecentActivity(storeId, supabase);

      const analytics: StoreAnalytics = {
        revenue,
        sales,
        products,
        orders,
        topProducts,
        recentActivity,
      };

      console.log('✅ Store analytics fetched successfully');
      return analytics;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    retryDelay: 1000,
    enabled: !!user && !!storeId,
  });

  return {
    analytics: analytics || getEmptyAnalytics(),
    isLoading,
    error,
  };
}

function getEmptyAnalytics(): StoreAnalytics {
  return {
    revenue: {
      total: 0,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      lastMonth: 0,
      growth: 0,
    },
    sales: {
      total: 0,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      lastMonth: 0,
      growth: 0,
    },
    products: {
      total: 0,
      active: 0,
      draft: 0,
      archived: 0,
    },
    orders: {
      total: 0,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      averageOrderValue: 0,
    },
    topProducts: [],
    recentActivity: [],
  };
}

function calculateRevenueMetrics(
  orders: Array<{ total_price: number; created_at: string }>,
  dates: {
    today: Date;
    thisWeekStart: Date;
    thisMonthStart: Date;
    lastMonthStart: Date;
    lastMonthEnd: Date;
  }
) {
  const now = new Date();
  
  const today = orders.filter(order => 
    new Date(order.created_at) >= dates.today
  ).reduce((sum, order) => sum + (order.total_price || 0), 0);

  const thisWeek = orders.filter(order => 
    new Date(order.created_at) >= dates.thisWeekStart
  ).reduce((sum, order) => sum + (order.total_price || 0), 0);

  const thisMonth = orders.filter(order => 
    new Date(order.created_at) >= dates.thisMonthStart
  ).reduce((sum, order) => sum + (order.total_price || 0), 0);

  const lastMonth = orders.filter(order => {
    const orderDate = new Date(order.created_at);
    return orderDate >= dates.lastMonthStart && orderDate <= dates.lastMonthEnd;
  }).reduce((sum, order) => sum + (order.total_price || 0), 0);

  const total = orders.reduce((sum, order) => sum + (order.total_price || 0), 0);

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

function calculateSalesMetrics(
  orders: Array<{ id: string; created_at: string }>,
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

function calculateProductMetrics(products: Array<{ title: string; current_price?: number }>) {
  // Note: The products table doesn't have status fields yet
  // Using all products as active for now
  return {
    total: products.length,
    active: products.length, // All products are active by default
    draft: 0,
    archived: 0,
  };
}

function calculateOrderMetrics(
  orders: Array<{ id: string; created_at: string }>,
  revenueData: Array<{ total_price: number; created_at: string }>
) {
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

  const totalRevenue = revenueData.reduce((sum, order) => sum + (order.total_price || 0), 0);
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  return {
    total: orders.length,
    today: todayOrders,
    thisWeek: thisWeekOrders,
    thisMonth: thisMonthOrders,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
  };
}

async function fetchTopProducts(storeId: string, supabase: any) {
  // This would need a more complex query to get product performance
  // For now, return empty array
  return [];
}

async function fetchRecentActivity(storeId: string, supabase: any) {
  // This would fetch from an activity log table
  // For now, return empty array
  return [];
}
