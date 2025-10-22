// Hook for managing products using React Query
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthenticatedFetch } from '@/shared/lib/apiClient';
import { useCurrentStore } from '@/features/auth';
import type { ProductWithPricing, ProductFilter, ProductPricing } from '../types';
import type { ShopifyProduct } from '@/features/shopify-integration';
import { getShopifyClient } from '@/features/shopify-integration';

// Function to add pricing data to Shopify products
function addPricingToProduct(shopifyProduct: ShopifyProduct): ProductWithPricing {
  // Get the first variant's price as the current price
  const firstVariant = shopifyProduct.variants[0];
  let currentPrice = 0;
  
  if (firstVariant) {
    const rawPrice = parseFloat(firstVariant.price);
    // Validate price is reasonable (not NaN, not negative, not too large)
    if (!isNaN(rawPrice) && rawPrice >= 0 && rawPrice <= 999999.99) {
      currentPrice = rawPrice;
    } else {
      console.warn(`Invalid price for product ${shopifyProduct.id}: ${firstVariant.price}`);
      currentPrice = 0;
    }
  }
  
  // Calculate base price (current price for now, could be enhanced with pricing strategies)
  const basePrice = currentPrice;
  
  // Calculate cost (assume 60% of base price for now, could be enhanced with actual cost data)
  const cost = basePrice * 0.6;
  
  // Calculate max price (assume 150% of base price for now)
  const maxPrice = basePrice * 1.5;
  
  // Calculate profit margin (avoid division by zero)
  const profitMargin = basePrice > 0 ? ((basePrice - cost) / basePrice) * 100 : 0;

  const pricing: ProductPricing = {
    basePrice,
    cost,
    maxPrice,
    currentPrice,
    profitMargin,
    lastUpdated: new Date(),
  };

  return {
    ...shopifyProduct,
    pricing,
  };
}

export function useProducts(filter?: ProductFilter) {
  // NEW AUTH: Get authenticated fetch that includes store ID
  const authenticatedFetch = useAuthenticatedFetch();
  
  // Get current store to check if it's loaded
  const { currentStore, isLoading: storeLoading } = useCurrentStore();
  
  // Use React Query for data fetching with automatic caching
  const { 
    data: shopifyProducts = [], 
    isLoading, 
    error: queryError,
    refetch 
  } = useQuery({
    queryKey: ['products', currentStore?.id], // Include store ID in cache key
    queryFn: async () => {
      // Don't fetch if no store is selected
      if (!currentStore?.id) {
        throw new Error('No store selected');
      }
      
      // Fetch via server-side proxy with authenticated store context
      const res = await authenticatedFetch('/api/shopify/products', { cache: 'no-store' });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const response = await res.json();

      if (!response.success || !response.data) {
        console.error('Shopify API Error:', response?.error || {});
        throw new Error(response?.error?.message || 'Failed to fetch products');
      }

      return response.data || [];
    },
    enabled: !!currentStore?.id, // Only fetch when we have a store
    staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Cache persists for 10 minutes
  });

  // Transform Shopify products to ProductWithPricing with error handling
  let productsWithPricing = shopifyProducts.map((product: ShopifyProduct) => {
    try {
      return addPricingToProduct(product);
    } catch (error) {
      console.error(`Error processing product ${product.id}:`, error);
      // Return a fallback product with safe defaults
      return {
        ...product,
        pricing: {
          basePrice: 0,
          cost: 0,
          maxPrice: 0,
          currentPrice: 0,
          profitMargin: 0,
          lastUpdated: new Date(),
        },
      };
    }
  });
  
  // Apply filters (client-side filtering for instant results)
  let filtered = [...productsWithPricing];

  if (filter?.search) {
    const searchLower = filter.search.toLowerCase();
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower)
    );
  }

  if (filter?.tags && filter.tags.length > 0) {
    filtered = filtered.filter(p =>
      filter.tags!.some(tag => p.tags.includes(tag))
    );
  }

  if (filter?.status) {
    filtered = filtered.filter(p => p.status === filter.status);
  }

  // Apply sorting
  if (filter?.sortBy) {
    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (filter.sortBy) {
        case 'title':
          aVal = a.title;
          bVal = b.title;
          break;
        case 'price':
          aVal = a.pricing.currentPrice;
          bVal = b.pricing.currentPrice;
          break;
        case 'updated':
          aVal = new Date(a.updatedAt).getTime();
          bVal = new Date(b.updatedAt).getTime();
          break;
        default:
          aVal = a.title;
          bVal = b.title;
      }

      if (filter.sortDirection === 'desc') {
        return aVal > bVal ? -1 : 1;
      }
      return aVal < bVal ? -1 : 1;
    });
  }

  return { 
    products: filtered, 
    loading: isLoading || storeLoading, // Include store loading state
    error: queryError ? (queryError as Error).message : null, 
    refetch 
  };
}