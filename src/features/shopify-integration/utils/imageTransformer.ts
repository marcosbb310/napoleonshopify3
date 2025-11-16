// Image transformation utilities
// Converts database image format to ShopifyImage format

import type { ShopifyImage } from '../types';

interface RawImage {
  id?: string | number;
  src?: string;
  url?: string;
  image_url?: string;
  alt?: string;
  width?: number;
  height?: number;
}

/**
 * Transforms images from database format to ShopifyImage format
 * Handles multiple input formats: array, null, undefined, stringified JSON, or string URLs
 * 
 * @param images - Raw images from database (can be array, null, undefined, string, or stringified JSON)
 * @param productId - Shopify product ID for generating fallback IDs
 * @param productTitle - Product title for alt text fallback
 * @returns Array of ShopifyImage objects
 */
export function transformProductImages(
  images: unknown,
  productId: string,
  productTitle: string
): ShopifyImage[] {
  // Handle null or undefined
  if (!images) {
    return [];
  }

  let imageArray: unknown[];

  // Handle stringified JSON
  if (typeof images === 'string') {
    // Check if it looks like a URL (starts with http:// or https://)
    // If so, treat it as a single image URL, not JSON
    if (images.startsWith('http://') || images.startsWith('https://')) {
      // Single URL string - wrap in array for processing
      imageArray = [images];
    } else {
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(images);
        imageArray = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.error(`❌ [ImageTransform] Failed to parse JSON string for product ${productId}:`, error);
        return [];
      }
    }
  }
  // Handle array
  else if (Array.isArray(images)) {
    imageArray = images;
  }
  // Invalid format
  else {
    console.error(`❌ [ImageTransform] Invalid image format for product ${productId}:`, {
      type: typeof images,
      value: images,
    });
    return [];
  }

  // Empty array
  if (imageArray.length === 0) {
    return [];
  }

  // Transform each image
  const transformed: ShopifyImage[] = imageArray
    .map((img: unknown, index: number) => {
      // Handle string URL (simple case)
      if (typeof img === 'string') {
        return {
          id: `img_${productId}_${index}`,
          productId,
          src: img,
          alt: productTitle,
          width: 800,
          height: 800,
        };
      }

      // Handle object format
      if (typeof img === 'object' && img !== null) {
        const imageObj = img as RawImage;
        // Try multiple possible src field names (handles different formats from database)
        const src = imageObj.src || imageObj.url || imageObj.image_url || (imageObj as any).source;

        // Must have a source URL
        if (!src) {
          console.warn(`⚠️ [ImageTransform] Image at index ${index} for product ${productId} has no src/url/image_url:`, imageObj);
          return null;
        }

        // Ensure src is a string
        if (typeof src !== 'string') {
          console.warn(`⚠️ [ImageTransform] Image src is not a string for product ${productId} at index ${index}:`, typeof src, src);
          return null;
        }

        return {
          id: imageObj.id?.toString() || `img_${productId}_${index}`,
          productId,
          src: src, // Already verified as string above
          alt: imageObj.alt || productTitle,
          width: imageObj.width || 800,
          height: imageObj.height || 800,
        };
      }

      // Invalid image format
      console.warn(`⚠️ [ImageTransform] Invalid image format at index ${index} for product ${productId}:`, {
        type: typeof img,
        value: img,
      });
      return null;
    })
    .filter((img): img is ShopifyImage => img !== null); // Filter out nulls

  return transformed;
}

/**
 * Logs image transformation statistics for debugging
 */
export function logImageStats(
  products: Array<{ title: string; shopify_id: string; images: unknown }>
): void {
  const stats = {
    total: products.length,
    withImages: 0,
    withoutImages: 0,
    imageCounts: [] as number[],
  };

  products.forEach((product) => {
    const imageArray = Array.isArray(product.images) ? product.images : [];
    if (imageArray.length > 0) {
      stats.withImages++;
      stats.imageCounts.push(imageArray.length);
    } else {
      stats.withoutImages++;
    }
  });

  console.log('📊 [ImageTransform] Image Statistics:', {
    totalProducts: stats.total,
    productsWithImages: stats.withImages,
    productsWithoutImages: stats.withoutImages,
    averageImagesPerProduct: stats.imageCounts.length > 0
      ? (stats.imageCounts.reduce((a, b) => a + b, 0) / stats.imageCounts.length).toFixed(1)
      : 0,
    maxImages: stats.imageCounts.length > 0 ? Math.max(...stats.imageCounts) : 0,
  });

  if (stats.withoutImages > 0) {
    console.warn(`⚠️ [ImageTransform] ${stats.withoutImages} products have no images. Consider re-syncing.`);
  }
}

