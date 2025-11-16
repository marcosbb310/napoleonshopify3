import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useTestSync() {
  return useMutation({
    mutationFn: async (storeId: string) => {
      const response = await fetch('/api/shopify/test-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Test sync failed');
      }
      
      return result;
    },
    onSuccess: (result) => {
      toast.success('Diagnostics passed!', {
        description: `Shopify: ${result.diagnostic.productsInShopify} products, Database: ${result.diagnostic.productsInDatabase}`,
      });
      console.log('📊 Full diagnostic:', result);
    },
    onError: (error) => {
      toast.error('Diagnostic failed', {
        description: error.message || 'Unknown error',
      });
      console.error('❌ Diagnostic error:', error);
    },
  });
}

