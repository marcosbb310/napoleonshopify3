// Skeleton component for authentication loading
'use client';

import { Skeleton } from '@/shared/components/ui/skeleton';

export function AuthSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar Skeleton */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Logo Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="hidden sm:flex flex-col gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>

          {/* Navigation Menu Skeleton */}
          <div className="hidden md:flex items-center gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-md" />
            ))}
          </div>

          {/* User Menu Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </header>
      
      {/* Main Content Skeleton */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    </div>
  );
}

// Minimal skeleton for auth initialization - only shows content area
export function AuthInitSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <Skeleton className="h-8 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  );
}

