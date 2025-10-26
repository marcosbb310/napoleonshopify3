import { createAdminClient } from '@/shared/lib/supabase';
import type { 
  ValidationResult, 
  ValidationErrorCode,
  ShopValidationCacheRow 
} from '../types';

/**
 * Shop Validation Service
 * Validates Shopify shop domains with caching
 * 
 * Validation steps:
 * 1. Format validation (must end with .myshopify.com)
 * 2. Check cache (24 hour TTL)
 * 3. DNS lookup to verify domain exists
 * 4. Cache result
 */

const CACHE_TTL_HOURS = 24;

/**
 * Validate a Shopify shop domain
 * 
 * @param domain - The shop domain to validate
 * @returns Validation result with normalized domain
 * 
 * @example
 * const result = await validateShopDomain('mystore');
 * // result.isValid = true
 * // result.shopDomain = 'mystore.myshopify.com'
 * 
 * const result2 = await validateShopDomain('invalid-shop');
 * // result2.isValid = false
 * // result2.error = 'Store not found'
 * // result2.suggestion = 'Check the spelling...'
 */
export async function validateShopDomain(
  domain: string
): Promise<ValidationResult> {
  // Step 1: Normalize domain
  const normalizedDomain = normalizeDomain(domain);
  
  // Step 2: Format validation
  const formatResult = validateFormat(normalizedDomain);
  if (!formatResult.isValid) {
    return formatResult;
  }
  
  // Step 3: Check cache
  const cachedResult = await getCachedValidation(normalizedDomain);
  if (cachedResult) {
    return cachedResult;
  }
  
  // Step 4: DNS lookup
  const dnsResult = await validateDNS(normalizedDomain);
  
  // Step 5: Cache result
  await cacheValidation(normalizedDomain, dnsResult);
  
  return dnsResult;
}

/**
 * Normalize shop domain
 * - Trim whitespace
 * - Convert to lowercase
 * - Add .myshopify.com if missing
 * 
 * @internal
 */
function normalizeDomain(domain: string): string {
  let normalized = domain.trim().toLowerCase();
  
  // Remove protocol if present
  normalized = normalized.replace(/^https?:\/\//, '');
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  // Add .myshopify.com if not present
  if (!normalized.includes('.myshopify.com')) {
    normalized = `${normalized}.myshopify.com`;
  }
  
  return normalized;
}

/**
 * Validate domain format
 * @internal
 */
function validateFormat(domain: string): ValidationResult {
  // Must end with .myshopify.com
  if (!domain.endsWith('.myshopify.com')) {
    return {
      isValid: false,
      shopDomain: domain,
      error: 'Invalid shop domain format',
      errorCode: 'INVALID_FORMAT',
      suggestion: 'Shop domain must end with .myshopify.com (e.g., mystore.myshopify.com)',
    };
  }
  
  // Extract shop name (part before .myshopify.com)
  const shopName = domain.replace('.myshopify.com', '');
  
  // Shop name must be at least 3 characters
  if (shopName.length < 3) {
    return {
      isValid: false,
      shopDomain: domain,
      error: 'Shop name too short',
      errorCode: 'INVALID_FORMAT',
      suggestion: 'Shop name must be at least 3 characters',
    };
  }
  
  // Shop name can only contain letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(shopName)) {
    return {
      isValid: false,
      shopDomain: domain,
      error: 'Invalid characters in shop name',
      errorCode: 'INVALID_FORMAT',
      suggestion: 'Shop name can only contain letters, numbers, and hyphens',
    };
  }
  
  return {
    isValid: true,
    shopDomain: domain,
  };
}

/**
 * Validate domain via DNS lookup
 * @internal
 */
async function validateDNS(domain: string): Promise<ValidationResult> {
  try {
    // Try to fetch the shop's homepage
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // If we get any response (even 404), the domain exists
    if (response.status === 404 || response.status === 403) {
      // Domain exists but might not be a Shopify store
      return {
        isValid: false,
        shopDomain: domain,
        error: 'Store not found',
        errorCode: 'DOMAIN_NOT_FOUND',
        suggestion: 'This domain exists but may not be a Shopify store. Check the spelling.',
      };
    }
    
    // 200-399 status codes indicate a valid store
    if (response.status >= 200 && response.status < 400) {
      return {
        isValid: true,
        shopDomain: domain,
      };
    }
    
    return {
      isValid: false,
      shopDomain: domain,
      error: 'Unable to verify store',
      errorCode: 'DNS_LOOKUP_FAILED',
      suggestion: 'Please check the domain and try again',
    };
  } catch (error) {
    // Network error or timeout
    return {
      isValid: false,
      shopDomain: domain,
      error: 'Network error',
      errorCode: 'NETWORK_ERROR',
      suggestion: 'Unable to connect. Check your internet connection and try again.',
    };
  }
}

/**
 * Get cached validation result
 * @internal
 */
async function getCachedValidation(
  domain: string
): Promise<ValidationResult | null> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('shop_validation_cache')
    .select('*')
    .eq('shop_domain', domain)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error || !data) {
    return null;
  }
  
  const row = data as ShopValidationCacheRow;
  
  return {
    isValid: row.is_valid,
    shopDomain: domain,
    error: row.validation_data?.error as string | undefined,
    errorCode: row.validation_data?.errorCode as ValidationErrorCode | undefined,
    suggestion: row.validation_data?.suggestion as string | undefined,
  };
}

/**
 * Cache validation result
 * @internal
 */
async function cacheValidation(
  domain: string,
  result: ValidationResult
): Promise<void> {
  const supabase = createAdminClient();
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);
  
  const validationData = result.isValid
    ? null
    : {
        error: result.error,
        errorCode: result.errorCode,
        suggestion: result.suggestion,
      };
  
  await supabase
    .from('shop_validation_cache')
    .upsert({
      shop_domain: domain,
      is_valid: result.isValid,
      validation_data: validationData,
      validated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
  
  // Don't throw on cache errors - validation still succeeded
}
