'use client';

import { Progress } from '@/shared/components/ui/progress';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { OAuthProgressProps } from '../types';

/**
 * OAuth Progress Component
 * 
 * Shows visual progress during OAuth flow
 */
export function OAuthProgress({
  step,
  totalSteps,
  status,
  message,
  error,
}: OAuthProgressProps) {
  const steps = [
    { id: 1, title: 'Validating Store', description: 'Checking store domain' },
    { id: 2, title: 'Redirecting', description: 'Opening Shopify authorization' },
    { id: 3, title: 'Authorizing', description: 'Waiting for your approval' },
    { id: 4, title: 'Connecting', description: 'Setting up integration' },
    { id: 5, title: 'Syncing', description: 'Importing your products' },
  ];

  const progress = (step / totalSteps) * 100;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Step {step} of {totalSteps}</span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {message && (
        <p className="text-sm text-center text-muted-foreground">{message}</p>
      )}

      {error && (
        <div className="flex items-center space-x-2 text-sm text-red-500">
          <XCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        {steps.map((s, index) => {
          const isCompleted = index < step - 1;
          const isCurrent = index === step - 1;
          const isPending = index >= step;

          return (
            <div
              key={s.id}
              className={`flex items-center space-x-3 p-2 rounded-lg ${
                isCurrent ? 'bg-blue-50 dark:bg-blue-950' : ''
              }`}
            >
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                isCompleted ? 'bg-green-500 text-white' :
                isCurrent ? 'bg-blue-500 text-white' :
                'bg-gray-200 text-gray-500 dark:bg-gray-800'
              }`}>
                {isCompleted ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : isCurrent ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  s.id
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  isPending ? 'text-muted-foreground' : ''
                }`}>
                  {s.title}
                </p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
