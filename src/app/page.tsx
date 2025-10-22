// Landing/Login page
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, AuthModal, useShopifyOAuth } from '@/features/auth';
import { Button } from '@/shared/components/ui/button';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { initiateOAuth } = useShopifyOAuth();
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    // Redirect if user is authenticated
    if (isAuthenticated) {
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
  }, [isAuthenticated, router]);

  const handleConnectStore = () => {
    if (isAuthenticated) {
      initiateOAuth();
    } else {
      setShowAuth(true);
    }
  };

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
        <Button size="lg" onClick={handleConnectStore}>
          Connect Your Shopify Store
        </Button>
      </div>

      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </div>
  );
}