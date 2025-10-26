// Shopify API client service
import type { 
  ShopifyProduct, 
  ShopifyCredentials, 
  ShopifyApiResponse 
} from '../types';
import { shopifyRateLimiter } from '@/shared/lib/rateLimiter';

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
      return response as unknown as ShopifyApiResponse<ShopifyProduct[]>;
    }

    // Transform Shopify API response to our format
    const transformedProducts: ShopifyProduct[] = response.data.products.map((product: Record<string, unknown>) => ({
      id: product.id?.toString() || '',
      title: product.title as string || '',
      handle: product.handle as string || '',
      description: product.body_html as string || '',
      vendor: product.vendor as string || '',
      productType: product.product_type as string || '',
      tags: product.tags ? (product.tags as string).split(',').map((tag: string) => tag.trim()) : [],
      status: product.status as 'active' | 'draft' | 'archived',
      images: Array.isArray(product.images) ? product.images.map((image: Record<string, unknown>) => ({
        id: image.id?.toString() || '',
        productId: product.id?.toString() || '',
        src: image.src as string || '',
        alt: image.alt as string || '',
        width: image.width as number || 800,
        height: image.height as number || 800,
      })) : [],
      variants: Array.isArray(product.variants) ? product.variants.map((variant: Record<string, unknown>) => ({
        id: variant.id?.toString() || '',
        productId: product.id?.toString() || '',
        title: variant.title as string || '',
        sku: variant.sku as string || '',
        price: variant.price as string || '0',
        compareAtPrice: variant.compare_at_price as string || undefined,
        inventoryQuantity: variant.inventory_quantity as number || 0,
        inventoryManagement: variant.inventory_management as string || undefined,
        weight: variant.weight as number || undefined,
        weightUnit: variant.weight_unit as 'g' | 'kg' | 'oz' | 'lb' || undefined,
        image: variant.image ? {
          id: (variant.image as Record<string, unknown>).id?.toString() || '',
          productId: product.id?.toString() || '',
          src: (variant.image as Record<string, unknown>).src as string || '',
          alt: (variant.image as Record<string, unknown>).alt as string || '',
          width: (variant.image as Record<string, unknown>).width as number || 800,
          height: (variant.image as Record<string, unknown>).height as number || 800,
        } : undefined,
        createdAt: variant.created_at as string || '',
        updatedAt: variant.updated_at as string || '',
      })) : [],
      createdAt: product.created_at as string || '',
      updatedAt: product.updated_at as string || '',
    }));

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
