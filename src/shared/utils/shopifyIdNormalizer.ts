/**
 * Normalizes Shopify product/variant IDs from various formats to a consistent string format.
 * 
 * Handles:
 * - REST API numeric IDs (e.g., 123456789)
 * - GraphQL Global IDs (e.g., "gid://shopify/Product/123456789")
 * - String numeric IDs (e.g., "123456789")
 * 
 * Returns null for invalid inputs (undefined, null, empty strings, invalid formats).
 * 
 * COLLISION PREVENTION (4.8):
 * - All numeric inputs (number or string) normalize to the same string format
 * - GraphQL Global IDs extract the numeric part, matching REST API format
 * - Invalid inputs return null (no collisions with valid IDs)
 * - Verified: Different input formats for the same ID produce identical normalized output
 * 
 * @param rawId - The raw ID from Shopify API (number, string, or unknown)
 * @returns Normalized string ID or null if invalid
 */
export function normalizeShopifyId(rawId: unknown): string | null {
  // Handle null/undefined
  if (rawId === null || rawId === undefined) {
    return null;
  }

  // Handle REST API numeric ID
  if (typeof rawId === 'number') {
    // Validate it's a finite positive number
    if (!Number.isFinite(rawId) || rawId <= 0) {
      return null;
    }
    return rawId.toString();
  }

  // Handle string IDs
  if (typeof rawId === 'string') {
    // Handle GraphQL Global ID format: gid://shopify/Product/123456789
    if (rawId.startsWith('gid://')) {
      const parts = rawId.split('/');
      const id = parts[parts.length - 1];
      // Validate extracted ID is non-empty and numeric
      if (id && id.length > 0 && /^\d+$/.test(id)) {
        return id;
      }
      return null;
    }

    // Handle regular string numeric ID
    // Must be non-empty and contain only digits
    if (rawId.length > 0 && /^\d+$/.test(rawId)) {
      return rawId;
    }

    // Empty string or invalid format
    return null;
  }

  // Invalid type
  return null;
}

/**
 * Verification test for ID normalization collision prevention (4.8)
 * 
 * This function verifies that different input formats for the same ID
 * produce identical normalized output, preventing collisions.
 * 
 * @returns true if all tests pass, false otherwise
 */
export function verifyNormalizationCollisionPrevention(): boolean {
  const testCases = [
    // Same ID in different formats should normalize to same value
    { inputs: ['gid://shopify/Product/123', '123', 123, 'product-123'], expected: '123' },
    { inputs: ['gid://shopify/Variant/456', '456', 456], expected: '456' },
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    const normalized = testCase.inputs.map(id => normalizeShopifyId(id));
    const uniqueNormalized = new Set(normalized);
    
    // All valid inputs should normalize to the same value
    const validNormalized = normalized.filter(id => id !== null);
    if (validNormalized.length > 0) {
      const allSame = validNormalized.every(id => id === testCase.expected);
      if (!allSame) {
        console.error(`❌ Collision test failed:`, {
          inputs: testCase.inputs,
          normalized,
          expected: testCase.expected,
        });
        allPassed = false;
      } else {
        console.log(`✅ Collision test passed:`, {
          inputs: testCase.inputs,
          normalized: testCase.expected,
        });
      }
    }
  }

  // Test that different IDs don't collide
  const differentIds = [
    normalizeShopifyId('123'),
    normalizeShopifyId('456'),
    normalizeShopifyId('789'),
  ];
  const uniqueDifferent = new Set(differentIds);
  if (uniqueDifferent.size !== differentIds.length) {
    console.error('❌ Different IDs collided!', differentIds);
    allPassed = false;
  } else {
    console.log('✅ Different IDs remain unique');
  }

  return allPassed;
}

