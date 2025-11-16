import { useQuery } from '@tanstack/react-query';

export function usePerformanceData(productId: string | null) {
  return useQuery({
    queryKey: ['product-performance', productId],
    queryFn: async () => {
      if (!productId) {
        throw new Error('Product ID is required');
      }

      const response = await fetch(`/api/products/${productId}/performance`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        
        if (response.status === 404) {
          throw new Error('Product data not found in database. Try syncing your products first.');
        }
        
        throw new Error(`Failed to fetch performance data: ${errorMessage}`);
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch performance data');
      }
      
      return result.data;
    },
    enabled: !!productId, // Only run when productId is provided
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

