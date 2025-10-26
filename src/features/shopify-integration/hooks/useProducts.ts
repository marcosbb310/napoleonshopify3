'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/shared/lib/supabase';
import { toast } from 'sonner';
import type { ShopifyProduct } from '../types';

export interface ProductFilters {
  search?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  status?: 'active' | 'draft' | 'archived';
  sortBy?: 'name' | 'price' | 'created_at' | 'updated_at' | 'sales';
  sortOrder?: 'asc' | 'desc';
}

export interface ProductSyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  totalProducts: number;
  syncedProducts: number;
  error?: string;
}

export function useProducts(storeId?: string, filters?: ProductFilters) {
  const supabase = createClient();
  const queryClient = useQueryClient();

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

  // Fetch products from local database
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['products', storeId, filters],
    queryFn: async () => {
      if (!storeId) {
        console.log('❌ No store ID provided');
        return [];
      }

      console.log('🔍 Fetching products for store:', storeId);

      // Build query
      let query = supabase
        .from('products')
        .select(`
          id,
          shopify_id,
          title,
          handle,
          vendor,
          product_type,
          tags,
          status,
          created_at,
          updated_at,
          variants:product_variants(
            id,
            shopify_id,
            title,
            price,
            compare_at_price,
            sku,
            inventory_quantity,
            weight,
            weight_unit,
            image_url,
            created_at,
            updated_at
          )
        `)
        .eq('store_id', storeId)
        .eq('is_active', true);

      // Apply filters
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%,handle.ilike.%${filters.search}%`);
      }

      if (filters?.vendor) {
        query = query.eq('vendor', filters.vendor);
      }

      if (filters?.productType) {
        query = query.eq('product_type', filters.productType);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }

      // Apply sorting
      const sortBy = filters?.sortBy || 'updated_at';
      const sortOrder = filters?.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error } = await query;

      if (error) {
        console.error('❌ Failed to fetch products:', error);
        throw error;
      }

      console.log('✅ Products fetched successfully:', data?.length || 0);

      // Transform data to match ShopifyProduct interface
      const transformedProducts: ShopifyProduct[] = (data || []).map(product => ({
        id: product.shopify_id,
        title: product.title,
        handle: product.handle,
        description: (product as any).description || '',
        vendor: product.vendor,
        productType: product.product_type,
        tags: product.tags || [],
        status: product.status,
        images: (product as any).images || [],
        variants: (product.variants || []).map((variant: any) => ({
          id: variant.shopify_id,
          productId: product.shopify_id,
          title: variant.title,
          price: (variant.price || '0').toString(),
          compareAtPrice: variant.compare_at_price ? variant.compare_at_price.toString() : undefined,
          sku: variant.sku,
          inventoryQuantity: variant.inventory_quantity || 0,
          weight: variant.weight || 0,
          weightUnit: variant.weight_unit || 'kg',
          image: variant.image_url ? {
            id: `img_${variant.id}`,
            productId: product.shopify_id,
            src: variant.image_url,
            alt: variant.title,
            width: 800,
            height: 800,
          } : undefined,
          createdAt: variant.created_at,
          updatedAt: variant.updated_at,
        })),
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      }));

      return transformedProducts;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: 1000,
    enabled: !!user && !!storeId,
  });

  // Sync products from Shopify
  const syncProducts = useMutation({
    mutationFn: async (storeId: string) => {
      const response = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Product sync failed');
      }

      return result;
    },
    onSuccess: () => {
      toast.success('Products synced successfully!');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['store-sync-statuses'] });
    },
    onError: (error) => {
      toast.error(`Product sync failed: ${error.message}`);
    },
  });

  // Update product price
  const updateProductPrice = useMutation({
    mutationFn: async ({ 
      storeId, 
      productId, 
      variantId, 
      price 
    }: { 
      storeId: string; 
      productId: string; 
      variantId: string; 
      price: number; 
    }) => {
      const response = await fetch('/api/shopify/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          productId,
          variantId,
          price,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Price update failed');
      }

      return result;
    },
    onSuccess: () => {
      toast.success('Price updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      toast.error(`Price update failed: ${error.message}`);
    },
  });

  // Get sync status
  const { data: syncStatus } = useQuery({
    queryKey: ['product-sync-status', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .from('sync_status')
        .select('*')
        .eq('store_id', storeId)
        .eq('sync_type', 'products')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to fetch sync status:', error);
        return null;
      }

      return data ? {
        isSyncing: data.status === 'in_progress',
        lastSyncAt: data.completed_at || data.started_at,
        totalProducts: data.total_products || 0,
        syncedProducts: data.products_synced || 0,
        error: data.error_message,
      } as ProductSyncStatus : null;
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!storeId,
  });

  return {
    products,
    isLoading,
    error,
    syncProducts,
    updateProductPrice,
    syncStatus,
  };
}
