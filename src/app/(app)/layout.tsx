// Layout for authenticated app pages
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/shared/components/ui/sidebar';
import { AuthSkeleton, AuthInitSkeleton } from '@/shared/components';
import { AppSidebar } from './_components/AppSidebar';
import { UserMenu } from './_components/UserMenu';
import { useAuth, useAuthHydration } from '@/features/auth';
import { usePathname } from 'next/navigation';
import { Separator } from '@/shared/components/ui/separator';
import { Toaster } from '@/shared/components/ui/sonner';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Page title will be rendered here by child pages */}
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 pt-6">
          {children}
        </main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
