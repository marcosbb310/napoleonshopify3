import { useQuery } from '@tanstack/react-query';
import { useCurrentStore } from '@/features/auth';

export function useStoreMetrics(dateRange?: { from: Date; to: Date }) {
  const { currentStore } = useCurrentStore();
  
  return useQuery({
    queryKey: ['store-metrics', currentStore?.id, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!currentStore) throw new Error('No store selected');
      
      const params = new URLSearchParams({
        storeId: currentStore.id
      });
      
      if (dateRange?.from) params.append('from', dateRange.from.toISOString());
      if (dateRange?.to) params.append('to', dateRange.to.toISOString());
      
      const response = await fetch(`/api/analytics/store-metrics?${params}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch metrics');
      }
      
      return result.data;
    },
    enabled: !!currentStore,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}
