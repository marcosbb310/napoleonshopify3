# Complete Application Fix - Bulletproof Implementation Plan

## PHASE 0: Prerequisites & Validation (30 minutes)

### 0.1 Environment Variables Check

Create validation script to verify all required env vars exist:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY  
- SUPABASE_SERVICE_ROLE_KEY
- SHOPIFY_API_KEY
- SHOPIFY_API_SECRET
- NEXT_PUBLIC_APP_URL
- TRIGGER_SECRET_KEY

**File:** `src/shared/lib/envCheck.ts` (NEW)

```typescript
export function validateEnvironment() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'NEXT_PUBLIC_APP_URL',
    'TRIGGER_SECRET_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(', ')}`);
  }
}
```

### 0.2 Database Migration Status Check

Verify migrations 001-014 are applied in Supabase dashboard.

Required tables: users, stores, products, pricing_config, pricing_history, sales_data, oauth_sessions, shop_validation_cache

### 0.3 Backup Current Code

Create git branch: `feature/complete-fix-implementation`

Command: `git checkout -b feature/complete-fix-implementation`

## PHASE 1: Critical Bug Fixes (30 minutes)

**DEPENDENCY:** None - must be done FIRST to fix breaking bugs

### 1.1 Fix Broken Auth Import

**File:** `src/features/product-management/hooks/useProducts.ts`

**Line 57:** Remove `const { useAuth } = require('@/features/auth');`

**Line 3:** Add `import { useAuth } from '@/features/auth';`

**Exact change:**

```typescript
// OLD (lines 56-58):
  // Import useAuth to check authentication status
  const { useAuth } = require('@/features/auth');
  const { isAuthenticated, isLoading: authLoading } = useAuth();

// NEW (add to imports at top, remove lines 56-57):
import { useAuth } from '@/features/auth';

// Keep line 58 as is:
  const { isAuthenticated, isLoading: authLoading } = useAuth();
```

### 1.2 Fix Store Selection Race Conditions

**File:** `src/features/auth/hooks/useCurrentStore.ts`

**Lines 12-58:** Simplify useEffect logic

```typescript
// Replace lines 12-58 with:
useEffect(() => {
  if (typeof window === 'undefined' || !stores) return;
  
  // No stores available - clear everything
  if (stores.length === 0) {
    setStoreId(null);
    localStorage.removeItem('selected-store-id');
    return;
  }
  
  // Try to load saved store
  const savedStoreId = localStorage.getItem('selected-store-id');
  const savedStoreExists = savedStoreId && stores.find(s => s.id === savedStoreId);
  
  if (savedStoreExists) {
    setStoreId(savedStoreId);
  } else {
    // Use first store as default
    const firstStoreId = stores[0].id;
    setStoreId(firstStoreId);
    localStorage.setItem('selected-store-id', firstStoreId);
  }
}, [stores]);
```

### 1.3 Add Global Error Boundary

**File:** `src/shared/components/ErrorBoundary.tsx` (NEW)

```typescript
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error_logs table
    fetch('/api/errors/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error_type: 'react_error_boundary',
        error_message: error.message,
        stack_trace: error.stack,
        context: { componentStack: errorInfo.componentStack },
        severity: 'high'
      })
    }).catch(console.error);
    
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              {this.state.error && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Error details
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              <div className="flex gap-2">
                <Button onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => this.setState({ hasError: false })}
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**File:** `src/app/layout.tsx`

**Update:** Wrap children with ErrorBoundary (after QueryProvider)

```typescript
// Add import:
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

// Wrap children (around line 40):
<QueryProvider>
  <ErrorBoundary>
    {children}
  </ErrorBoundary>
</QueryProvider>
```

### 1.4 Add Error Logging API Route

**File:** `src/app/api/errors/log/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/shared/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    
    const body = await request.json();
    
    // Get user_id from users table if authenticated
    let userId = null;
    if (user) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
      userId = userRecord?.id;
    }
    
    // Insert error log
    const { error } = await supabase
      .from('error_logs')
      .insert({
        user_id: userId,
        error_type: body.error_type,
        error_message: body.error_message,
        stack_trace: body.stack_trace,
        context: body.context || {},
        severity: body.severity || 'medium'
      });
    
    if (error) {
      console.error('Failed to log error:', error);
      return NextResponse.json({ success: false }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging endpoint failed:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
```

## PHASE 2: Database Schema Extensions (1 hour)

**CRITICAL:** Must be done AFTER Phase 1, BEFORE any service layer code that depends on these tables.

[Content continues with all remaining phases from the original plan file...]

## Success Criteria

- [ ] All mock data replaced with real calculations
- [ ] Analytics dashboard shows live data with 5min polling
- [ ] Product performance scores calculated automatically
- [ ] Price changes tracked with impact analysis
- [ ] Webhooks processing orders successfully (logged in webhook_logs)
- [ ] Background jobs running on schedule (visible in Trigger.dev dashboard)
- [ ] Error rate < 1% (monitored in error_logs table)
- [ ] API response times < 200ms (test with browser DevTools)
- [ ] All tests passing (run `npm test`)
- [ ] Documentation complete and accurate

## Post-Implementation Monitoring

### Week 1:
- Monitor error_logs table daily
- Check webhook_logs for delivery failures
- Verify Trigger.dev job success rates
- Monitor API response times in production

### Week 2-4:
- Validate data accuracy against Shopify admin
- Review performance metrics
- Gather user feedback
- Optimize slow queries

### Ongoing:
- Weekly review of error_logs
- Monthly audit of audit_logs
- Quarterly performance optimization
- Regular dependency updates

