import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';

export function useStoreConnection() {
  const { currentStore } = useAuth();
  
  const { data: isValid, isLoading, error } = useQuery({
    queryKey: ['store-connection', currentStore?.id],
    queryFn: async () => {
      if (!currentStore) {
        return false;
      }

      // Test Shopify API connection by making a simple request
      const response = await fetch('/api/shopify/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId: currentStore.id,
          shopDomain: currentStore.shop_domain,
        }),
      });

      if (!response.ok) {
        throw new Error('Connection test failed');
      }

      const result = await response.json();
      return result.success === true;
    },
    enabled: !!currentStore,
    staleTime: 5 * 60 * 1000, // Check every 5 minutes
    retry: 1,
    refetchOnWindowFocus: true,
  });
  
  return { 
    isConnected: isValid ?? false, 
    isLoading: isLoading || !currentStore,
    error,
    currentStore
  };
}
