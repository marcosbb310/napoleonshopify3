// Shopify API client service
import type { 
  ShopifyProduct, 
  ShopifyCredentials, 
  ShopifyApiResponse 
} from '../types';

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
  }

  async getProducts(): Promise<ShopifyApiResponse<ShopifyProduct[]>> {
    const response = await this.request<{ products: any[] }>('/products.json?limit=250');
    
    if (!response.success || !response.data) {
      return response as ShopifyApiResponse<ShopifyProduct[]>;
    }

    // Transform Shopify API response to our format
    const transformedProducts: ShopifyProduct[] = response.data.products.map((product: any) => ({
      id: product.id.toString(),
      title: product.title,
      handle: product.handle,
      description: product.body_html || '',
      vendor: product.vendor || '',
      productType: product.product_type || '',
      tags: product.tags ? product.tags.split(',').map((tag: string) => tag.trim()) : [],
      status: product.status as 'active' | 'draft' | 'archived',
      images: product.images?.map((image: any) => ({
        id: image.id.toString(),
        productId: product.id.toString(),
        src: image.src,
        alt: image.alt || '',
        width: image.width || 800,
        height: image.height || 800,
      })) || [],
      variants: product.variants?.map((variant: any) => ({
        id: variant.id.toString(),
        productId: product.id.toString(),
        title: variant.title,
        sku: variant.sku || '',
        price: variant.price,
        compareAtPrice: variant.compare_at_price,
        inventoryQuantity: variant.inventory_quantity || 0,
        inventoryManagement: variant.inventory_management,
        weight: variant.weight,
        weightUnit: variant.weight_unit as 'g' | 'kg' | 'oz' | 'lb',
        image: variant.image ? {
          id: variant.image.id.toString(),
          productId: product.id.toString(),
          src: variant.image.src,
          alt: variant.image.alt || '',
          width: variant.image.width || 800,
          height: variant.image.height || 800,
        } : undefined,
        createdAt: variant.created_at,
        updatedAt: variant.updated_at,
      })) || [],
      createdAt: product.created_at,
      updatedAt: product.updated_at,
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
