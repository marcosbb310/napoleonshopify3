import { useQuery } from '@tanstack/react-query';

export function useProductAnalytics(productId?: string) {
  return useQuery({
    queryKey: ['product-analytics', productId],
    queryFn: async () => {
      if (!productId) throw new Error('No product ID');
      
      const response = await fetch(`/api/analytics/products/${productId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analytics');
      }
      
      return result.data;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
