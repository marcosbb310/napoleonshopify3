// Home page with authentication
'use client';

import { useAuth } from '@/features/auth';
import { AuthModal } from '@/features/auth/components/AuthModal';
import { Button } from '@/shared/components/ui/button';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function HomePageContent() {
  const { isAuthenticated, isLoading, error } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');

  // Handle authentication errors and timeouts
  useEffect(() => {
    if (error) {
      console.error('Authentication error:', error);
      setAuthError('Authentication service temporarily unavailable. Please try again later.');
    }
  }, [error]);

  // Set a timeout for authentication loading
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn('Authentication taking too long, showing fallback UI');
        setAuthError('Authentication is taking longer than expected. You can still explore the app.');
      }, 5000); // 5 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  // Auto-close modal when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setShowAuth(false);
      // Redirect to the intended page or dashboard
      if (redirectPath) {
        router.push(redirectPath);
      } else {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, router, redirectPath]);

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push(redirectPath || '/dashboard');
    }
  }, [isAuthenticated, isLoading, router, redirectPath]);

  // Show loading state while checking authentication (with timeout)
  if (isLoading && !authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show redirecting message if authenticated
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-2xl text-center space-y-8">
        <div>
          <h1 className="text-5xl font-bold tracking-tight">
            Smart Pricing for Shopify
          </h1>
          <p className="mt-4 text-xl text-muted-foreground">
            AI-powered dynamic pricing that maximizes your revenue automatically
          </p>
        </div>
        
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold text-primary">
            Welcome to Smart Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Get started by signing in to your account
          </p>
          
          {/* Show error message if authentication failed */}
          {authError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <p className="font-medium">Notice:</p>
              <p>{authError}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <Button 
              onClick={() => setShowAuth(true)}
              size="lg"
              className="w-full max-w-sm"
            >
              Sign In / Sign Up
            </Button>
            <p className="text-sm text-muted-foreground">
              Access your dashboard to start optimizing your Shopify store pricing
            </p>
          </div>
        </div>
      </div>

      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}