// Layout for authenticated app pages
'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthSkeleton, AuthInitSkeleton, AppNavbar } from '@/shared/components';
import { useAuth, useAuthHydration } from '@/features/auth';
import { Toaster } from '@/shared/components/ui/sonner';
import { SmartPricingProvider } from '@/features/pricing-engine';

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, isInitialized } = useAuth();
  
  // Handle auth hydration to prevent hydration mismatch
  useAuthHydration();

  // Save the current page on refresh/load for potential redirect after login
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (currentPath !== '/') {
      sessionStorage.setItem('intended-page', currentPath);
    }
  }, []);

  // Only redirect if auth is initialized and user is not authenticated
  useEffect(() => {
    if (isInitialized && !isLoading && !isAuthenticated) {
      // Save the current page before redirecting so user can return to it after login
      const currentPath = window.location.pathname;
      if (currentPath !== '/') {
        sessionStorage.setItem('intended-page', currentPath);
      }
      router.push('/');
    }
  }, [isAuthenticated, isLoading, isInitialized, router]);

  // Show loading during actual authentication operations (login/register)
  if (isLoading) {
    return <AuthSkeleton />;
  }

  // Show minimal loading while auth state is being rehydrated
  // Skip for dashboard since it handles its own loading state
  if (!isInitialized && pathname !== '/dashboard') {
    return <AuthInitSkeleton />;
  }

  // If user is not authenticated, don't render anything
  // (redirect will happen in useEffect above)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppNavbar />
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
