// Shopify integration types

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  status: 'active' | 'draft' | 'archived';
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyVariant {
  id: string;
  productId: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice?: string;
  inventoryQuantity: number;
  inventoryManagement?: string;
  weight?: number; // in grams
  weightUnit?: 'g' | 'kg' | 'oz' | 'lb';
  image?: ShopifyImage;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyImage {
  id: string;
  productId: string;
  src: string;
  alt?: string;
  width: number;
  height: number;
}

export interface ShopifyCredentials {
  storeUrl: string;
  accessToken: string;
}

export interface ShopifyApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

export interface ShopifyWebhookEvent {
  id: string;
  topic: string;
  payload: unknown;
  receivedAt: Date;
}

export type ShopifyApiResponse<T> = {
  data?: T;
  error?: ShopifyApiError;
  success: boolean;
};
