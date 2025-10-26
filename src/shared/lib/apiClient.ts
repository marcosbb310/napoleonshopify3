import { useCurrentStore } from '@/features/auth';

// Request deduplication cache
const pendingRequests = new Map<string, Promise<Response>>();

export function useAuthenticatedFetch() {
  const { currentStore, isLoading } = useCurrentStore();
  
  return async (url: string, options: RequestInit = {}) => {
    // Don't make requests if store is still loading
    if (isLoading) {
      throw new Error('Store is still loading');
    }
    
    // Don't make requests if no store is selected
    if (!currentStore?.id) {
      throw new Error('No store selected');
    }
    
    // Create cache key
    const cacheKey = `${url}-${JSON.stringify(options)}`;
    
    // Check if request is already pending
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey)!.then(r => r.clone());
    }
    
    // Make request
    const headers = new Headers(options.headers);
    headers.set('x-store-id', currentStore.id);
    
    const requestPromise = fetch(url, {
      ...options,
      headers
    });
    
    pendingRequests.set(cacheKey, requestPromise);
    
    // Clean up after request completes
    requestPromise.finally(() => {
      pendingRequests.delete(cacheKey);
    });
    
    return requestPromise;
  };
}