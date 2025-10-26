'use client';

import { useQuery } from '@tanstack/react-query';
import type { ValidationResult } from '../types';

/**
 * React Query hook for shop domain validation
 * 
 * Features:
 * - Real-time validation as user types
 * - Automatic caching (24 hours)
 * - Debouncing handled by React Query
 * 
 * @param domain - The shop domain to validate
 * @param enabled - Whether validation should run (default: domain.length > 3)
 * @returns React Query result with validation data
 * 
 * @example
 * const { data: validation, isLoading } = useShopValidation(shopDomain);
 * 
 * if (validation?.isValid) {
 *   // Show green checkmark
 * } else if (validation?.error) {
 *   // Show error message
 * }
 */
export function useShopValidation(
  domain: string,
  enabled: boolean = domain.length > 3
) {
  return useQuery<ValidationResult>({
    queryKey: ['shop-validation', domain],
    queryFn: async () => {
      // Call validation API endpoint
      const response = await fetch('/api/shopify/validate-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });

      if (!response.ok) {
        throw new Error('Validation failed');
      }

      const result = await response.json();
      return result;
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: false, // Don't retry validation failures
  });
}
