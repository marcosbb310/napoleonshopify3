// Product management types
import type { ShopifyProduct } from '@/features/shopify-integration';

export interface ProductWithPricing extends ShopifyProduct {
  pricing: ProductPricing;
}

export interface ProductPricing {
  basePrice: number;
  cost: number;
  maxPrice: number;
  currentPrice: number;
  profitMargin: number;
  lastUpdated: Date;
}

export interface BulkPriceUpdate {
  type: 'percentage' | 'fixed';
  value: number;
  applyTo: 'basePrice' | 'maxPrice' | 'cost';
  productIds: string[];
}

export interface ProductFilter {
  search?: string;
  tags?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  priceMin?: number;
  priceMax?: number;
  marginMin?: number;
  marginMax?: number;
  vendors?: string[];
  productTypes?: string[];
  status?: 'active' | 'draft' | 'archived';
  sortBy?: 'title' | 'price' | 'updated' | 'sales';
  sortDirection?: 'asc' | 'desc';
}

export interface ProductSelection {
  selectedIds: Set<string>;
  selectAll: boolean;
}
