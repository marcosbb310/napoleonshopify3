import { describe, it, expect } from 'vitest';
import { normalizeShopifyId } from '../shopifyIdNormalizer';

describe('normalizeShopifyId', () => {
  describe('REST API numeric IDs', () => {
    it('should normalize positive numeric ID', () => {
      expect(normalizeShopifyId(123456789)).toBe('123456789');
    });

    it('should normalize zero to null (invalid)', () => {
      expect(normalizeShopifyId(0)).toBeNull();
    });

    it('should normalize negative number to null (invalid)', () => {
      expect(normalizeShopifyId(-123)).toBeNull();
    });

    it('should normalize Infinity to null (invalid)', () => {
      expect(normalizeShopifyId(Infinity)).toBeNull();
    });

    it('should normalize NaN to null (invalid)', () => {
      expect(normalizeShopifyId(NaN)).toBeNull();
    });
  });

  describe('GraphQL Global IDs', () => {
    it('should extract ID from Product Global ID', () => {
      expect(normalizeShopifyId('gid://shopify/Product/123456789')).toBe('123456789');
    });

    it('should extract ID from Variant Global ID', () => {
      expect(normalizeShopifyId('gid://shopify/ProductVariant/987654321')).toBe('987654321');
    });

    it('should handle Global ID with different resource types', () => {
      expect(normalizeShopifyId('gid://shopify/Collection/456789')).toBe('456789');
    });

    it('should return null for Global ID with empty ID part', () => {
      expect(normalizeShopifyId('gid://shopify/Product/')).toBeNull();
    });

    it('should return null for Global ID with non-numeric ID', () => {
      expect(normalizeShopifyId('gid://shopify/Product/abc123')).toBeNull();
    });

    it('should return null for malformed Global ID', () => {
      expect(normalizeShopifyId('gid://shopify/')).toBeNull();
    });
  });

  describe('String numeric IDs', () => {
    it('should normalize string numeric ID', () => {
      expect(normalizeShopifyId('123456789')).toBe('123456789');
    });

    it('should return null for empty string', () => {
      expect(normalizeShopifyId('')).toBeNull();
    });

    it('should return null for string with non-numeric characters', () => {
      expect(normalizeShopifyId('123abc')).toBeNull();
    });

    it('should return null for string "null"', () => {
      expect(normalizeShopifyId('null')).toBeNull();
    });

    it('should return null for string "undefined"', () => {
      expect(normalizeShopifyId('undefined')).toBeNull();
    });
  });

  describe('Invalid inputs', () => {
    it('should return null for null', () => {
      expect(normalizeShopifyId(null)).toBeNull();
    });

    it('should return null for undefined', () => {
      expect(normalizeShopifyId(undefined)).toBeNull();
    });

    it('should return null for boolean', () => {
      expect(normalizeShopifyId(true)).toBeNull();
      expect(normalizeShopifyId(false)).toBeNull();
    });

    it('should return null for object', () => {
      expect(normalizeShopifyId({ id: 123 })).toBeNull();
    });

    it('should return null for array', () => {
      expect(normalizeShopifyId([123])).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle very large numbers', () => {
      expect(normalizeShopifyId(999999999999999)).toBe('999999999999999');
    });

    it('should handle single digit IDs', () => {
      expect(normalizeShopifyId(1)).toBe('1');
      expect(normalizeShopifyId('1')).toBe('1');
    });

    it('should handle string with leading zeros', () => {
      expect(normalizeShopifyId('000123')).toBe('000123');
    });
  });
});

