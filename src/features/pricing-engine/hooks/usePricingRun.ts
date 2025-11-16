import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedFetch } from '@/shared/lib/apiClient';
import { toast } from 'sonner';

export function usePricingRun() {
  const queryClient = useQueryClient();
  const authenticatedFetch = useAuthenticatedFetch();
  
  return useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch('/api/pricing/run', { 
        method: 'POST' 
      });
      
      const result = await res.json();
      
      if (!res.ok || !result.success) {
        throw new Error(result.error || result.message || 'Pricing run failed');
      }
      
      return result;
    },
    onSuccess: (result) => {
      // Check if algorithm was skipped due to global toggle being disabled
      if (result.skipped) {
        toast.info('Pricing algorithm skipped', {
          description: result.message || 'Global smart pricing is disabled. Enable it to run pricing.',
          duration: 5000,
        });
      } else {
        const s = result.stats || {};
        // Check if any products were actually processed
        if (s.processed === 0) {
          toast.info('Pricing run completed', {
            description: result.message || 'No products were processed',
            duration: 5000,
          });
        } else {
          toast.success('Pricing run completed!', {
            description: `Processed: ${s.processed || 0}, Increased: ${s.increased || 0}, Reverted: ${s.reverted || 0}`,
            duration: 5000,
          });
        }
      }
      
      // Invalidate products query to refetch updated prices
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      toast.error('Pricing run failed', { 
        description: error.message || 'Unknown error' 
      });
    },
  });
}

