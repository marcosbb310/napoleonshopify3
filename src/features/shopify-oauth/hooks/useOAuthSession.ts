'use client';

import { useQuery } from '@tanstack/react-query';
import type { OAuthSession } from '../types';

/**
 * OAuth Session Hook
 * 
 * Tracks OAuth session status (for polling)
 */
export function useOAuthSession(sessionId?: string) {
  return useQuery<OAuthSession | null>({
    queryKey: ['oauth-session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;

      const response = await fetch(`/api/auth/shopify/v2/session/${sessionId}`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.session || null;
    },
    enabled: !!sessionId,
    refetchInterval: 2000, // Poll every 2 seconds
    staleTime: 0, // Always fetch fresh data
  });
}
