'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { OAuthInitiateRequest, OAuthInitiateResponse } from '../types';

/**
 * OAuth Flow Hook
 * 
 * Handles OAuth initiation and redirect
 */
export function useOAuthFlow() {
  const [isInitiating, setIsInitiating] = useState(false);

  const initiateMutation = useMutation({
    mutationFn: async (shopDomain: string) => {
      const response = await fetch('/api/auth/shopify/v2/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopDomain } as OAuthInitiateRequest),
      });

      const data = await response.json() as OAuthInitiateResponse;

      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate OAuth');
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.oauthUrl) {
        // Open OAuth in popup window (not redirect)
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          data.oauthUrl,
          'shopify-oauth',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
        
        if (!popup) {
          toast.error('Please allow popups for this site');
          return;
        }
        
        // Monitor popup (will be closed by callback script)
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
          }
        }, 500);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to connect store');
      setIsInitiating(false);
    },
  });

  const initiateOAuth = async (shopDomain: string) => {
    setIsInitiating(true);
    return initiateMutation.mutateAsync(shopDomain);
  };

  return {
    initiateOAuth,
    isInitiating: isInitiating || initiateMutation.isPending,
  };
}
