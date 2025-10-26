// React Query Provider for client-side data fetching and caching
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { toast } from 'sonner';

export function QueryProvider({ children }: { children: ReactNode }) {
  // Create a client instance - useState ensures it's only created once per component mount
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false, // Disable for better UX
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
        onError: (error) => {
          // Global error handler
          const message = error instanceof Error ? error.message : 'An error occurred';
          toast.error(message);
          
          // Log to error_logs
          fetch('/api/errors/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error_type: 'mutation_error',
              error_message: message,
              severity: 'medium'
            })
          }).catch(console.error);
        }
      }
    }
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

