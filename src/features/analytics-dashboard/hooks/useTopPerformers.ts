import { useQuery } from '@tanstack/react-query';
import { useCurrentStore } from '@/features/auth';

export function useTopPerformers(limit: number = 10) {
  const { currentStore } = useCurrentStore();
  
  return useQuery({
    queryKey: ['top-performers', currentStore?.id, limit],
    queryFn: async () => {
      if (!currentStore) throw new Error('No store selected');
      
      const response = await fetch(
        `/api/analytics/top-performers?storeId=${currentStore.id}&limit=${limit}`
      );
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch top performers');
      }
      
      return result.data;
    },
    enabled: !!currentStore,
    staleTime: 5 * 60 * 1000,
  });
}
