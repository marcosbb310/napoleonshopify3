// Landing/Login page
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm, useAuth, useAuthHydration } from '@/features/auth';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuth();
  
  // Handle auth hydration to prevent hydration mismatch
  useAuthHydration();

  useEffect(() => {
    // Only redirect if auth is initialized and user is authenticated
    if (isInitialized && isAuthenticated) {
      // Check if there's a saved intended page (from a refresh or direct navigation)
      const savedPage = sessionStorage.getItem('intended-page');
      
      if (savedPage && savedPage !== '/') {
        // Clear the saved page and redirect to it
        sessionStorage.removeItem('intended-page');
        router.push(savedPage);
      } else {
        // Default to dashboard if no specific page was intended
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, isInitialized, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Smart Pricing
          </h1>
          <p className="mt-2 text-muted-foreground">
            Maximize profits with intelligent dynamic pricing
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}