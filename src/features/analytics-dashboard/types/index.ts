// Analytics dashboard types

export interface DashboardMetrics {
  totalRevenue: number;
  totalProfit: number;
  averageProfitMargin: number;
  activeProducts: number;
  priceChangesToday: number;
  revenueChange: number;
  profitChange: number;
}

export interface PriceHistoryData {
  date: Date;
  productId: string;
  productName: string;
  price: number;
  sales: number;
  revenue: number;
  profit: number;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  currentPrice: number;
  avgPrice: number;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;
  priceChanges: number;
}

export interface TimeSeriesData {
  date: string;
  revenue: number;
  profit: number;
  avgPrice: number;
  sales: number;
}
