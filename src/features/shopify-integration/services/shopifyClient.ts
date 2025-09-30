// Shopify API client service
import type { 
  ShopifyProduct, 
  ShopifyCredentials, 
  ShopifyApiResponse 
} from '../types';

export class ShopifyClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(credentials: ShopifyCredentials) {
    this.baseUrl = `https://${credentials.storeUrl}/admin/api/2024-10`;
    this.accessToken = credentials.accessToken;
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
    return this.request<ShopifyProduct[]>('/products.json');
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

// Singleton instance - will be initialized with user credentials
let shopifyClientInstance: ShopifyClient | null = null;

export function initializeShopifyClient(credentials: ShopifyCredentials) {
  shopifyClientInstance = new ShopifyClient(credentials);
  return shopifyClientInstance;
}

export function getShopifyClient(): ShopifyClient {
  if (!shopifyClientInstance) {
    throw new Error('Shopify client not initialized');
  }
  return shopifyClientInstance;
}
