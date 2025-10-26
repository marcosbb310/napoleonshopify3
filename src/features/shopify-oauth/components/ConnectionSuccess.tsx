'use client';

import { CheckCircle2, Store, Calendar } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import type { ConnectionSuccessProps } from '../types';

/**
 * Connection Success Component
 * 
 * Shows success message after store connection
 */
export function ConnectionSuccess({ store, onContinue }: ConnectionSuccessProps) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Store Connected Successfully!</h3>
        <p className="text-sm text-muted-foreground">
          Your Shopify store has been connected to Smart Pricing.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Store className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Store Domain</p>
                <p className="text-xs text-muted-foreground">{store.shopDomain}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Connected</p>
                <p className="text-xs text-muted-foreground">
                  {store.installedAt.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          We&apos;re now importing your products in the background. This may take a few minutes.
        </p>
        <Button onClick={onContinue} className="w-full">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
