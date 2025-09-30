// Hook for managing products
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProductWithPricing, ProductFilter, ProductPricing } from '../types';
import type { ShopifyProduct } from '@/features/shopify-integration/types';
import { getShopifyClient } from '@/features/shopify-integration/services/shopifyClient';

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
  const [products, setProducts] = useState<ProductWithPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch via server-side proxy to avoid CORS and hide token
      const res = await fetch('/api/shopify/products', { cache: 'no-store' });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const response: any = await res.json();

      if (!response.success || !response.data) {
        console.error('Shopify API Error:', response?.error || {});
        throw new Error(response?.error?.message || 'Failed to fetch products');
      }

      // Extract products from proxied Shopify response (already transformed)
      const shopifyProducts = (response.data || []) as ShopifyProduct[];

      // Transform Shopify products to ProductWithPricing with error handling
      const productsWithPricing = shopifyProducts.map((product) => {
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
      
      let filtered = [...productsWithPricing];

      // Apply filters
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

      setProducts(filtered);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter?.search, filter?.tags, filter?.status, filter?.sortBy, filter?.sortDirection]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const refetch = useCallback(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch };
}