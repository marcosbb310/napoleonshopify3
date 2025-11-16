// Shopify API client service
import type { 
  ShopifyProduct, 
  ShopifyCredentials, 
  ShopifyApiResponse 
} from '../types';
import { shopifyRateLimiter } from '@/shared/lib/rateLimiter';
import { normalizeShopifyId } from '@/shared/utils/shopifyIdNormalizer';

export class ShopifyClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(credentials?: ShopifyCredentials) {
    // Use provided credentials or fall back to environment variables
    const storeUrl = credentials?.storeUrl || process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    const accessToken = credentials?.accessToken || process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';

    if (!storeUrl || !accessToken) {
      throw new Error('Shopify credentials not provided. Please set NEXT_PUBLIC_SHOPIFY_STORE_URL and NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN environment variables.');
    }

    this.baseUrl = `https://${storeUrl}/admin/api/${apiVersion}`;
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ShopifyApiResponse<T>> {
    return shopifyRateLimiter.execute(async () => {
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': this.accessToken,
            ...options.headers,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          return {
            success: false,
            error: {
              message: error.errors || 'API request failed',
              statusCode: response.status,
            },
          };
        }

        const data = await response.json();
        return {
          success: true,
          data,
        };
      } catch (error) {
        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            statusCode: 500,
          },
        };
      }
    });
  }

  async getProducts(): Promise<ShopifyApiResponse<ShopifyProduct[]>> {
    const response = await this.request<{ products: Record<string, unknown>[] }>('/products.json?limit=250');
    
    if (!response.success || !response.data) {
      return response as ShopifyApiResponse<ShopifyProduct[]>;
    }

    // Transform Shopify API response to our format
    // Filter out products with invalid IDs at API ingestion layer
    const invalidProducts: Array<{ title: string; reason: string; rawId: unknown }> = [];
    
    const transformedProducts: ShopifyProduct[] = response.data.products
      .map((product: Record<string, unknown>) => {
        // Normalize product ID
        const normalizedProductId = normalizeShopifyId(product.id);
        
        if (!normalizedProductId) {
          invalidProducts.push({
            title: (product.title as string) || 'Unknown',
            reason: 'Missing or invalid product ID',
            rawId: product.id,
          });
          return null; // Will be filtered out
        }

        // Normalize variant IDs
        const normalizedVariants = product.variants?.map((variant: Record<string, unknown>) => {
          const normalizedVariantId = normalizeShopifyId(variant.id);
          if (!normalizedVariantId) {
            console.warn(`⚠️ Skipping variant with invalid ID in product ${normalizedProductId}:`, variant);
            return null;
          }

          return {
            id: normalizedVariantId,
            productId: normalizedProductId,
            title: variant.title,
            sku: variant.sku || '',
            price: variant.price,
            compareAtPrice: variant.compare_at_price,
            inventoryQuantity: variant.inventory_quantity || 0,
            inventoryManagement: variant.inventory_management,
            weight: variant.weight,
            weightUnit: variant.weight_unit as 'g' | 'kg' | 'oz' | 'lb',
            image: variant.image ? {
              id: normalizeShopifyId(variant.image.id) || '',
              productId: normalizedProductId,
              src: variant.image.src,
              alt: variant.image.alt || '',
              width: variant.image.width || 800,
              height: variant.image.height || 800,
            } : undefined,
            createdAt: variant.created_at,
            updatedAt: variant.updated_at,
          };
        }).filter((v): v is NonNullable<typeof v> => v !== null) || [];

        const transformedImages = product.images?.map((image: Record<string, unknown>) => ({
          id: normalizeShopifyId(image.id) || '',
          productId: normalizedProductId,
          src: image.src,
          alt: image.alt || '',
          width: image.width || 800,
          height: image.height || 800,
        })) || [];

        // Log image data for first few products
        if (transformedProducts.length < 3) {
          console.log(`🖼️  ShopifyClient: Product "${product.title}" images from API:`, {
            rawImagesCount: product.images?.length || 0,
            transformedImagesCount: transformedImages.length,
            firstImageSrc: transformedImages[0]?.src || 'none',
            rawImages: product.images
          });
        }

        return {
          id: normalizedProductId,
          title: product.title,
          handle: product.handle,
          description: product.body_html || '',
          vendor: product.vendor || '',
          productType: product.product_type || '',
          tags: product.tags ? product.tags.split(',').map((tag: string) => tag.trim()) : [],
          status: product.status as 'active' | 'draft' | 'archived',
          images: transformedImages,
          variants: normalizedVariants,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
        };
      })
      .filter((product): product is ShopifyProduct => product !== null);

    // Log invalid products if any
    if (invalidProducts.length > 0) {
      console.error(`❌ ShopifyClient: Skipped ${invalidProducts.length} product(s) with invalid IDs:`, invalidProducts);
    }

    if (transformedProducts.length < response.data.products.length) {
      console.warn(`⚠️ ShopifyClient: Filtered out ${response.data.products.length - transformedProducts.length} invalid product(s) from API response`);
    }

    return {
      success: true,
      data: transformedProducts,
    };
  }

  async getProduct(id: string): Promise<ShopifyApiResponse<ShopifyProduct>> {
    return this.request<ShopifyProduct>(`/products/${id}.json`);
  }

  async updateProductPrice(
    productId: string,
    variantId: string,
    price: string
  ): Promise<ShopifyApiResponse<void>> {
    return this.request<void>(`/variants/${variantId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        variant: {
          id: variantId,
          price,
        },
      }),
    });
  }

  async bulkUpdatePrices(
    updates: Array<{ variantId: string; price: string }>
  ): Promise<ShopifyApiResponse<void>> {
    // This will use Shopify's bulk operations API
    // For now, we'll do sequential updates
    const results = await Promise.all(
      updates.map(({ variantId, price }) =>
        this.updateProductPrice('', variantId, price)
      )
    );

    const hasErrors = results.some(r => !r.success);
    if (hasErrors) {
      return {
        success: false,
        error: {
          message: 'Some updates failed',
          statusCode: 500,
        },
      };
    }

    return { success: true };
  }

  async deleteProduct(productId: string): Promise<ShopifyApiResponse<void>> {
    return this.request<void>(`/products/${productId}.json`, {
      method: 'DELETE',
    });
  }

  async bulkDeleteProducts(productIds: string[]): Promise<ShopifyApiResponse<void>> {
    const results = await Promise.all(
      productIds.map(id => this.deleteProduct(id))
    );

    const hasErrors = results.some(r => !r.success);
    if (hasErrors) {
      const failedCount = results.filter(r => !r.success).length;
      return {
        success: false,
        error: {
          message: `${failedCount} product(s) failed to delete`,
          statusCode: 500,
        },
      };
    }

    return { success: true };
  }
}

// Singleton instance - will be initialized with user credentials or environment variables
let shopifyClientInstance: ShopifyClient | null = null;

export function initializeShopifyClient(credentials?: ShopifyCredentials) {
  shopifyClientInstance = new ShopifyClient(credentials);
  return shopifyClientInstance;
}

export function getShopifyClient(): ShopifyClient {
  if (!shopifyClientInstance) {
    // Try to initialize with environment variables
    try {
      shopifyClientInstance = new ShopifyClient();
    } catch (error) {
      throw new Error('Shopify client not initialized and environment variables not set. Please initialize with credentials or set environment variables.');
    }
  }
  return shopifyClientInstance;
}
