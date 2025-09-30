// Skeleton component for authentication loading
'use client';

import { Skeleton } from '@/shared/components/ui/skeleton';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/shared/components/ui/sidebar';
import { Separator } from '@/shared/components/ui/separator';

export function AuthSkeleton() {
  return (
    <SidebarProvider>
      {/* Sidebar Skeleton */}
      <div className="w-64 border-r bg-background">
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
      
      <SidebarInset>
        {/* Header Skeleton */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <Skeleton className="h-8 w-8" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        </header>
        
        {/* Main Content Skeleton */}
        <main className="flex flex-1 flex-col gap-4 p-4 pt-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
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

