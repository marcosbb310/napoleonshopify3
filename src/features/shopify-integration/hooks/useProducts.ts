'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/shared/lib/supabase';
import { toast } from 'sonner';
import type { ShopifyProduct } from '../types';
import { transformProductImages, logImageStats } from '../utils/imageTransformer';

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

export interface SyncProductsResponse {
  success: boolean;
  data: {
    totalProducts: number;
    syncedProducts: number;
    skippedProducts?: number;
    duration: number;
    errors: string[];
    invalidProducts?: Array<{ title: string; reason: string; rawId: unknown }>;
    debug?: {
      productsWithImages: number;
      totalProductsChecked: number;
      sampleProductImages: any;
    };
  };
  error: string | null;
}

export interface SyncMutationResult extends SyncProductsResponse {
  startedAt: string;
  completedAt: string;
}

// Note: filters parameter is kept for backward compatibility but is ignored
// All filtering now happens client-side for instant results
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
  // Query key: ['products', storeId] - no filters (client-side filtering only)
  // This allows instant filtering without re-fetching from database
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['products', storeId],
    queryFn: async () => {
      // VERY VISIBLE LOG - Should appear every time
      console.log('═══════════════════════════════════════════════════════');
      console.log('🚀🚀🚀 [useProducts] queryFn EXECUTING NOW 🚀🚀🚀');
      console.log('🚀 Store ID:', storeId);
      console.log('🚀 Timestamp:', new Date().toISOString());
      console.log('═══════════════════════════════════════════════════════');
      
      if (!storeId) {
        console.log('❌ No store ID provided');
        return [];
      }

      console.log('🔍 Fetching products for store:', storeId);

      // Build query - fetch ALL products for store (no server-side filtering)
      // Client-side filtering happens in the products page
      const query = supabase
        .from('products')
        .select(`
          id,
          shopify_id,
          title,
          description,
          handle,
          vendor,
          product_type,
          tags,
          status,
          images,
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
          ),
          pricing_config(
            auto_pricing_enabled
          )
        `)
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('❌ Failed to fetch products:', error);
        throw error;
      }

      console.log('✅ Products fetched successfully:', data?.length || 0);
      
      // CRITICAL: Check if images column was actually selected
      // Log immediately after query to see raw database response
      if (data && data.length > 0) {
        const sample = data[0];
        const hasImagesField = 'images' in sample;
        const imagesValue = (sample as any).images;
        
        console.log('🔍 IMAGE DEBUG - First product from DB:', {
          title: sample.title,
          hasImagesField,
          imagesType: typeof imagesValue,
          imagesValue: imagesValue,
          imagesIsArray: Array.isArray(imagesValue),
          imagesLength: Array.isArray(imagesValue) ? imagesValue.length : 'N/A',
        });
        
        // Count products with images
        const productsWithImages = data.filter((p: any) => {
          const imgs = p.images;
          return imgs && Array.isArray(imgs) && imgs.length > 0;
        });
        
        console.log(`📊 IMAGE STATS: ${productsWithImages.length}/${data.length} products have images`);
        
        if (productsWithImages.length === 0) {
          console.error('❌ NO PRODUCTS HAVE IMAGES! Images column is empty. You need to re-sync products.');
          console.error('❌ This means images were not saved during sync. Check sync logs above.');
        } else {
          console.log('✅ Images found in database! First product with images:', {
            title: productsWithImages[0]?.title,
            imageCount: productsWithImages[0]?.images?.length,
            firstImage: productsWithImages[0]?.images?.[0],
          });
        }
      }

      // Transform data to match ShopifyProduct interface
      // CRITICAL: Ensure shopify_id exists, otherwise filter out the product
      const transformedProducts: ShopifyProduct[] = (data || [])
        .filter(product => {
          if (!product.shopify_id) {
            console.warn(`⚠️ [useProducts] Product "${product.title}" (db_id: ${product.id}) has no shopify_id - skipping`);
            return false;
          }
          return true;
        })
        .map((product, index) => {
          // Debug first 3 products to see what images look like from database
          if (index < 3) {
            console.log(`🖼️ [useProducts] Product "${product.title}" (${product.shopify_id}):`, {
              rawImages: product.images,
              imagesType: typeof product.images,
              imagesIsArray: Array.isArray(product.images),
              imagesLength: Array.isArray(product.images) ? product.images.length : 'N/A',
            });
          }
          
          const transformedImages = transformProductImages(product.images, product.shopify_id, product.title);
          
          // Debug transformed images for first 3 products
          if (index < 3) {
            console.log(`🖼️ [useProducts] Transformed images for "${product.title}":`, {
              count: transformedImages.length,
              firstImage: transformedImages[0] || null,
            });
          }
          
          return {
            id: product.shopify_id!, // Non-null assertion since we filtered above
            title: product.title,
            description: product.description || '',
            handle: product.handle,
            vendor: product.vendor,
            productType: product.product_type,
            tags: product.tags || [],
            status: product.status,
            variants: (product.variants || []).map((variant: any) => ({
              id: variant.shopify_id,
              productId: product.shopify_id,
              title: variant.title,
              sku: variant.sku || '',
              price: variant.price?.toString() || '0',
              compareAtPrice: variant.compare_at_price ? variant.compare_at_price.toString() : undefined,
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
            // Transform product-level images using utility function
            images: transformedImages,
            createdAt: product.created_at,
            updatedAt: product.updated_at,
          };
        });

      // Log image statistics for debugging
      if (transformedProducts.length > 0) {
        logImageStats(transformedProducts.map(p => ({
          title: p.title,
          shopify_id: p.id,
          images: p.images,
        })));
        
        // Check if any products have images after transformation
        const productsWithTransformedImages = transformedProducts.filter(p => p.images && p.images.length > 0);
        if (productsWithTransformedImages.length === 0) {
          console.error('🚨 CRITICAL: NO PRODUCTS HAVE IMAGES AFTER TRANSFORMATION!');
          console.error('🚨 This means either:');
          console.error('   1. Images are not in the database (re-sync needed)');
          console.error('   2. Image transformation is failing');
          console.error('   3. Images are in wrong format');
          console.error('🚨 Check the logs above for "IMAGE DEBUG" and "IMAGE STATS"');
        } else {
          console.log(`✅ ${productsWithTransformedImages.length}/${transformedProducts.length} products have images after transformation`);
        }
      }

      console.log('🚀 [useProducts] queryFn COMPLETED - Returning', transformedProducts.length, 'products');
      return transformedProducts;
    },
    staleTime: 0, // TEMPORARY: Set to 0 to always refetch and see logs. Change back to 2 * 60 * 1000 after debugging
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: 1000,
    enabled: !!user && !!storeId,
  });

  // Sync products from Shopify
  const syncProducts = useMutation({
    mutationFn: async (storeId: string): Promise<SyncMutationResult> => {
      const startedAt = new Date().toISOString();
      console.log('🔵 SYNC MUTATION: Started with storeId:', storeId);

      const response = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storeId }),
      });

      console.log('🔵 SYNC MUTATION: Response status:', response.status);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // ignore parse errors and fall back to default error message
          }
        } else {
          // 404 means the route doesn't exist - likely a dev server issue
          if (response.status === 404) {
            errorMessage = `Sync API route not found (404). Please restart your Next.js dev server.`;
            console.error('❌ SYNC MUTATION: Route not found at /api/shopify/sync');
            console.error('❌ SYNC MUTATION: This usually means the dev server needs to be restarted');
          } else {
            errorMessage = `Route error. Please ensure the sync API route is available. (HTTP ${response.status})`;
          }
        }

        throw new Error(errorMessage);
      }

      const result: SyncProductsResponse = await response.json();
      console.log('🔵 SYNC MUTATION: Result:', result);

      // Log image debug info if available
      if (result.data?.debug) {
        console.log('🖼️  SYNC MUTATION: Image Debug Info:', {
          productsWithImages: result.data.debug.productsWithImages,
          totalProductsChecked: result.data.debug.totalProductsChecked,
          sampleProductImages: result.data.debug.sampleProductImages,
        });
        
        if (result.data.debug.productsWithImages === 0) {
          console.warn('⚠️  SYNC MUTATION: No products have images after sync!');
          console.warn('⚠️  Check server logs for detailed image sync information');
        }
      }

      const completedAt = new Date().toISOString();

      return {
        ...result,
        startedAt,
        completedAt,
      };
    },
    onSuccess: (data) => {
      console.log('🔵 SYNC MUTATION: onSuccess - invalidating queries');
      console.log('🔵 SYNC MUTATION: Sync data:', data);
      
      // Show detailed toast with sync statistics
      if (data?.success && data?.data) {
        const { totalProducts, syncedProducts, skippedProducts = 0, errors = [], duration } = data.data;
        const hasErrors = errors.length > 0;
        const hasSkipped = skippedProducts > 0;
        
        // Calculate sync percentage
        const syncPercentage = totalProducts > 0 
          ? Math.round((syncedProducts / totalProducts) * 100) 
          : 0;
        
        // Format duration
        const durationSeconds = Math.round(duration / 1000);
        const durationText = durationSeconds > 0 ? `in ${durationSeconds}s` : '';
        
        if (hasErrors) {
          // Show error toast if there were errors
          toast.error('Sync completed with errors', {
            description: `Synced ${syncedProducts}/${totalProducts} products (${syncPercentage}%)${durationText}. ${errors.length} error(s).`,
            duration: 10000,
          });
        } else if (hasSkipped) {
          // Show warning toast if products were skipped
          toast.warning('Sync completed with skipped products', {
            description: `Synced ${syncedProducts}/${totalProducts} products (${syncPercentage}%)${durationText}. ${skippedProducts} product(s) skipped.`,
            duration: 8000,
          });
        } else if (syncedProducts === 0 && totalProducts === 0) {
          // No products found
          toast.info('No products to sync', {
            description: 'Your store has no products yet.',
            duration: 5000,
          });
        } else {
          // Success - all products synced
          toast.success('Products synced successfully!', {
            description: `Synced ${syncedProducts}/${totalProducts} product${totalProducts !== 1 ? 's' : ''} (${syncPercentage}%)${durationText}.`,
            duration: 6000,
          });
        }
      } else {
        // Fallback for unexpected response format
        toast.success('Sync completed', {
          description: data?.error || 'Products synced from Shopify',
          duration: 5000,
        });
      }
      
      // Invalidate products for the specific store
      console.log('🔄 [SYNC] Invalidating cache for products query - this should trigger refetch');
      queryClient.invalidateQueries({ queryKey: ['products', storeId] });
      queryClient.invalidateQueries({ queryKey: ['store-sync-statuses'] });
      console.log('🔄 [SYNC] Cache invalidated - queryFn should run now');
    },
    onError: (error) => {
      console.log('🔵 SYNC MUTATION: onError called with:', error);
      toast.error('Sync failed', {
        description: error.message || 'Failed to sync products from Shopify',
        duration: 8000,
      });
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
    onSuccess: (_, variables) => {
      toast.success('Price updated successfully!');
      // Invalidate products for the specific store
      queryClient.invalidateQueries({ queryKey: ['products', variables.storeId] });
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
