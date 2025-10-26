// Layout for authenticated app pages
'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthSkeleton, AppNavbar, ConnectionStatusBanner } from '@/shared/components';
import { useAuth, useCurrentStore } from '@/features/auth';
import { useStoreConnection } from '@/features/shopify-integration/hooks/useStoreConnection';
import { Toaster } from '@/shared/components/ui/sonner';
import { SmartPricingProvider } from '@/features/pricing-engine';
import { useQueryClient } from '@tanstack/react-query';

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();
  const { currentStore } = useCurrentStore();
  const { isConnected, isLoading: isConnectionLoading } = useStoreConnection();
  const queryClient = useQueryClient();

  // Save the current page on refresh/load for potential redirect after login
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath !== '/') {
        sessionStorage.setItem('intended-page', currentPath);
      }
    }
  }, []);

  // Prefetch common data when store is available
  useEffect(() => {
    if (currentStore) {
      // Prefetch store metrics
      queryClient.prefetchQuery({
        queryKey: ['store-metrics', currentStore.id],
        queryFn: async () => {
          const response = await fetch(`/api/analytics/store-metrics?storeId=${currentStore.id}`);
          return response.json();
        }
      });
      
      // Prefetch top performers
      queryClient.prefetchQuery({
        queryKey: ['top-performers', currentStore.id, 10],
        queryFn: async () => {
          const response = await fetch(`/api/analytics/top-performers?storeId=${currentStore.id}&limit=10`);
          return response.json();
        }
      });
    }
  }, [currentStore, queryClient]);

  // Redirect if user is not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Save the current page before redirecting so user can return to it after login
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath !== '/') {
          sessionStorage.setItem('intended-page', currentPath);
        }
      }
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading during auth check
  if (isLoading) {
    return <AuthSkeleton />;
  }

  // If user is not authenticated, don't render anything
  // (redirect will happen in useEffect above)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppNavbar />
      <ConnectionStatusBanner 
        isConnected={isConnected}
        isLoading={isConnectionLoading}
        storeName={currentStore?.shop_domain}
        onReconnect={() => {
          // Redirect to settings page or trigger re-auth
          if (typeof window !== 'undefined') {
            window.location.href = '/settings';
          } else {
            router.push('/settings');
          }
        }}
      />
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
      <Toaster />
    </div>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SmartPricingProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </SmartPricingProvider>
  );
}
