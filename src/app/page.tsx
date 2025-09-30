// Landing/Login page
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm, useAuth } from '@/features/auth';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

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