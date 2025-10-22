// Home page with authentication
'use client';

import { useAuth } from '@/features/auth';
import { AuthModal } from '@/features/auth/components/AuthModal';
import { Button } from '@/shared/components/ui/button';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');

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

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, redirect to dashboard
  if (isAuthenticated) {
    router.push(redirectPath || '/dashboard');
    return null;
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