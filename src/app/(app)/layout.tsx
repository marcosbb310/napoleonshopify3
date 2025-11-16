// Layout for authenticated app pages
'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthSkeleton, AppNavbar, ConnectionStatusBanner } from '@/shared/components';
import { useAuth, useCurrentStore } from '@/features/auth';
import { useStoreConnection } from '@/features/shopify-integration/hooks/useStoreConnection';
import { Toaster } from '@/shared/components/ui/sonner';
import { SmartPricingProvider } from '@/features/pricing-engine';

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();
  const { currentStore } = useCurrentStore();
  const { isConnected, isLoading: isConnectionLoading } = useStoreConnection();

  // Save the current page on refresh/load for potential redirect after login
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath !== '/') {
        sessionStorage.setItem('intended-page', currentPath);
      }
    }
  }, []);

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
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          'linear-gradient(180deg, rgba(15, 27, 46, 0.98) 0%, rgba(12, 22, 36, 0.96) 40%, rgba(9, 16, 27, 0.94) 100%)',
      }}
    >
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
      <main
        className="flex-1 w-full px-4 py-8 md:px-6"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
          {children}
        </div>
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
