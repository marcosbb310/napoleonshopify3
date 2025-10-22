<!-- 61de4f94-e5a6-41a4-94b8-ed97cdfbf283 21a6f393-b8db-4ad4-b7d4-f9cfd70f6792 -->
# Production-Grade Authentication - Staged Implementation

## Overview

Staged rollout with NO breaking changes. Build new system in parallel, test thoroughly, then switch over with feature flag. All auth in modals, Shopify OAuth in popup, React Query everywhere.

---

## STAGE 1: Foundation (Non-Breaking)

### Step 1: Install Dependencies

```bash
npm install qrcode.react@3.1.0
# @supabase/ssr already installed (check package.json)
```

### Step 2: Generate Encryption Key

```bash
# Run this command and save output to .env.local
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
```

Add to `.env.local`:

```
ENCRYPTION_KEY=<generated-key>
USE_NEW_AUTH=false  # Feature flag
```

### Step 3: Complete Migration (with Backfill Strategy)

`supabase/migrations/008_supabase_auth_integration.sql`:

```sql
-- ============================================================================
-- PART 1: Schema Changes
-- ============================================================================

-- Add auth_user_id to users (nullable initially for backfill)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;

-- Create unique index (will be added after backfill)
-- CREATE UNIQUE INDEX idx_users_auth_user_id ON users(auth_user_id);

-- Auto-create user profile trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (auth_user_id) DO NOTHING;  -- Handle race conditions
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- PART 2: Encryption Setup
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted token column
ALTER TABLE stores ADD COLUMN IF NOT EXISTS access_token_encrypted BYTEA;

-- Encryption functions
CREATE OR REPLACE FUNCTION encrypt_token(token_text TEXT, key TEXT)
RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(token_text, key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_token(encrypted_data BYTEA, key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_data, key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 3: Security Tables
-- ============================================================================

-- Failed login attempts
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address INET NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_attempts_email_ip ON failed_login_attempts(email, ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_locked_until ON failed_login_attempts(locked_until);

-- Auto-cleanup old attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM failed_login_attempts WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Security audit log
CREATE TABLE IF NOT EXISTS auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,  -- Nullable during transition
  event_type TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_user_timestamp ON auth_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_timestamp ON auth_events(timestamp DESC);

-- ============================================================================
-- PART 4: Complete RLS Policies (Explicit, No Shortcuts)
-- ============================================================================

-- Products table policies
DROP POLICY IF EXISTS products_select_own_store ON products;
DROP POLICY IF EXISTS products_insert_own_store ON products;
DROP POLICY IF EXISTS products_update_own_store ON products;
DROP POLICY IF EXISTS products_delete_own_store ON products;
DROP POLICY IF EXISTS products_user_access ON products;

CREATE POLICY products_user_access ON products
  FOR ALL USING (
    store_id IN (
      SELECT s.id FROM stores s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Stores table policies
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stores_select_own ON stores;
DROP POLICY IF EXISTS stores_update_own ON stores;
DROP POLICY IF EXISTS stores_insert_own ON stores;
DROP POLICY IF EXISTS stores_delete_own ON stores;

CREATE POLICY stores_user_access ON stores
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Pricing config policies
DROP POLICY IF EXISTS pricing_config_select_own_store ON pricing_config;
DROP POLICY IF EXISTS pricing_config_update_own_store ON pricing_config;

CREATE POLICY pricing_config_user_access ON pricing_config
  FOR ALL USING (
    product_id IN (
      SELECT p.id FROM products p
      INNER JOIN stores s ON p.store_id = s.id
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Pricing history policies
DROP POLICY IF EXISTS pricing_history_select_own_store ON pricing_history;
DROP POLICY IF EXISTS pricing_history_insert_own_store ON pricing_history;

CREATE POLICY pricing_history_user_access ON pricing_history
  FOR ALL USING (
    store_id IN (
      SELECT s.id FROM stores s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Sales data policies
DROP POLICY IF EXISTS sales_data_select_own_store ON sales_data;
DROP POLICY IF EXISTS sales_data_insert_own_store ON sales_data;
DROP POLICY IF EXISTS sales_data_update_own_store ON sales_data;

CREATE POLICY sales_data_user_access ON sales_data
  FOR ALL USING (
    store_id IN (
      SELECT s.id FROM stores s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Algorithm runs policies
DROP POLICY IF EXISTS algorithm_runs_select_own_store ON algorithm_runs;
DROP POLICY IF EXISTS algorithm_runs_insert_own_store ON algorithm_runs;

CREATE POLICY algorithm_runs_user_access ON algorithm_runs
  FOR ALL USING (
    store_id IN (
      SELECT s.id FROM stores s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 5: Rollback Script (in comments for safety)
-- ============================================================================

/*
-- ROLLBACK SCRIPT - Run if migration fails
-- WARNING: Only run this if you need to rollback!

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

DROP POLICY IF EXISTS products_user_access ON products;
DROP POLICY IF EXISTS stores_user_access ON stores;
DROP POLICY IF EXISTS pricing_config_user_access ON pricing_config;
DROP POLICY IF EXISTS pricing_history_user_access ON pricing_history;
DROP POLICY IF EXISTS sales_data_user_access ON sales_data;
DROP POLICY IF EXISTS algorithm_runs_user_access ON algorithm_runs;

-- Recreate old policies (from migration 007)
-- ... (insert old policy definitions here)

DROP TABLE IF EXISTS auth_events;
DROP TABLE IF EXISTS failed_login_attempts;

DROP FUNCTION IF EXISTS encrypt_token(TEXT, TEXT);
DROP FUNCTION IF EXISTS decrypt_token(BYTEA, TEXT);
DROP FUNCTION IF EXISTS cleanup_old_login_attempts();

ALTER TABLE stores DROP COLUMN IF EXISTS access_token_encrypted;
ALTER TABLE users DROP COLUMN IF EXISTS auth_user_id;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled;
*/
```

### Step 4: Run Migration in Dev

```bash
# Test in local development first
npx supabase db push

# Verify tables created
npx supabase db diff
```

### Step 5: Configure Supabase Dashboard

**Authentication > Providers:**

- ✅ Email provider: ENABLED
- ✅ Enable email confirmations: OFF (optional verification)
- ✅ Secure email change: ON
- ✅ Enable sign-ups: ON

**Authentication > Email Templates:**

- Customize confirmation, magic link, password reset emails

**Authentication > Auth Settings:**

- JWT expiry: 3600 (1 hour)
- Refresh token reuse interval: 10 seconds
- Enable manual linking: OFF
- Enable anonymous sign-ins: OFF

**Authentication > Password:**

- Minimum password length: 10
- Require uppercase: ON
- Require lowercase: ON  
- Require numbers: ON
- Require special characters: ON

**Authentication > MFA:**

- Enable TOTP: ON
- Max enrolled factors: 10

**SMTP Settings (Project Settings > Auth):**

- Configure SendGrid/Postmark
- Test email delivery

---

## STAGE 2: Build New System (Parallel, Non-Breaking)

### Step 6: Rename Old Supabase Client

```bash
# Keep old code functional
mv src/shared/lib/supabase.ts src/shared/lib/supabase.old.ts
```

Update imports temporarily in existing code:

```typescript
// In files still using old auth
import { supabase, getSupabaseAdmin } from '@/shared/lib/supabase.old'
```

### Step 7: Create New Supabase SSR Client

`src/shared/lib/supabase.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Client Component
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server Component
export async function createServerClient() {
  const cookieStore = await cookies()
  
  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })
}

// API Route Handler
export function createRouteHandlerClient(request: NextRequest) {
  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        request.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        request.cookies.set({ name, value: '', ...options })
      },
    },
  })
}

// Middleware
export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request })
  
  const supabase = createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })
  
  return { supabase, response }
}

// Admin client (server-side only)
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client can only be used on server')
  }
  
  return createSSRServerClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
```

### Step 8: Create API Auth Helpers

`src/shared/lib/apiAuth.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient, createAdminClient } from './supabase'

export async function requireAuth(request: NextRequest) {
  const supabase = createRouteHandlerClient(request)
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return { 
      user: null, 
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) 
    }
  }
  
  // Log API access (non-blocking)
  logAuthEvent(user.id, 'api_access', request).catch(console.error)
  
  return { user, error: null }
}

export async function requireStore(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) return { user: null, store: null, error }
  
  const storeId = request.headers.get('x-store-id')
  if (!storeId) {
    return { 
      user, 
      store: null, 
      error: NextResponse.json({ error: 'x-store-id header required' }, { status: 400 }) 
    }
  }
  
  const supabase = createRouteHandlerClient(request)
  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single()
  
  if (!store) {
    return { 
      user, 
      store: null, 
      error: NextResponse.json({ error: 'Store not found or access denied' }, { status: 404 }) 
    }
  }
  
  return { user, store, error: null }
}

async function logAuthEvent(userId: string, eventType: string, request: NextRequest) {
  try {
    const supabase = createAdminClient()
    
    await supabase.from('auth_events').insert({
      user_id: userId,
      event_type: eventType,
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      user_agent: request.headers.get('user-agent'),
      metadata: { path: request.nextUrl.pathname },
    })
  } catch (error) {
    console.error('Failed to log auth event:', error)
  }
}
```

### Step 9: Create Auth Hooks

`src/features/auth/hooks/useAuth.ts`:

```typescript
'use client'
import { createClient } from '@/shared/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'

export function useAuth() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: session, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      return session
    },
    staleTime: 5 * 60 * 1000, // 5min
    gcTime: 10 * 60 * 1000, // 10min
  })

  // Listen to auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      queryClient.setQueryData(['session'], session)
      
      if (event === 'SIGNED_IN') {
        queryClient.invalidateQueries({ queryKey: ['stores'] })
      }
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
      }
    })
    
    return () => subscription.unsubscribe()
  }, [queryClient, supabase])

  // Auto-refresh session before expiry (50min before 1hr expiry)
  useEffect(() => {
    if (!session) return

    const refreshInterval = setInterval(async () => {
      const { data } = await supabase.auth.refreshSession()
      if (data.session) {
        queryClient.setQueryData(['session'], data.session)
      }
    }, 50 * 60 * 1000) // 50 minutes
    
    return () => clearInterval(refreshInterval)
  }, [session, supabase, queryClient])

  return {
    user: session?.user ?? null,
    session,
    isLoading,
    isAuthenticated: !!session,
  }
}
```

`src/features/auth/hooks/useAuthMutations.ts`:

```typescript
'use client'
import { createClient } from '@/shared/lib/supabase'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useSignup() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ email, password, name }: { email: string; password: string; name: string }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] })
      toast.success('Account created! Check email to verify.')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useLogin() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      // Check failed attempts first
      const checkRes = await fetch('/api/auth/check-login-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      
      if (!checkRes.ok) {
        const data = await checkRes.json()
        throw new Error(data.error || 'Too many failed attempts')
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      
      // Log successful login
      fetch('/api/auth/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'login' }),
      }).catch(console.error)
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] })
      toast.success('Welcome back!')
    },
    onError: async (error: Error, variables) => {
      // Track failed attempt
      fetch('/api/auth/track-failed-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: variables.email }),
      }).catch(console.error)
      
      toast.error(error.message)
    },
  })
}

export function useLogout() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.clear()
      toast.success('Signed out')
    },
  })
}

export function useMagicLink() {
  const supabase = createClient()
  
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Check your email for magic link!')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function usePasswordReset() {
  const supabase = createClient()
  
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Password reset email sent!')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
```

`src/features/auth/hooks/useStores.ts`:

```typescript
'use client'
import { createClient } from '@/shared/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { useState, useEffect } from 'react'

export function useStores() {
  const supabase = createClient()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stores')
        .select('*')
        .order('installed_at', { ascending: false })
      return data || []
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5min
    gcTime: 10 * 60 * 1000, // 10min
  })
}

export function useCurrentStore() {
  const { data: stores } = useStores()
  const queryClient = useQueryClient()
  const [storeId, setStoreId] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('selected-store-id')
    if (saved) setStoreId(saved)
  }, [])

  const currentStore = stores?.find(s => s.id === storeId) || stores?.[0]

  const switchStore = useMutation({
    mutationFn: async (newStoreId: string) => {
      localStorage.setItem('selected-store-id', newStoreId)
      return newStoreId
    },
    onSuccess: (newStoreId) => {
      setStoreId(newStoreId)
      // Invalidate all store-dependent data
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      toast.success('Store switched')
    },
  })

  return { 
    currentStore, 
    stores,
    switchStore: switchStore.mutate,
    isSwitching: switchStore.isPending,
  }
}
```

`src/features/auth/hooks/useShopifyOAuth.ts`:

```typescript
'use client'
import { useAuth } from './useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useShopifyOAuth() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  function initiateOAuth() {
    if (!user) {
      toast.error('Please create an account or sign in first')
      return
    }

    const shop = prompt('Enter your Shopify store domain\n(e.g., mystore.myshopify.com)')
    if (!shop) return

    const width = 600
    const height = 700
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2
    
    const popup = window.open(
      `/api/auth/shopify?shop=${encodeURIComponent(shop)}`,
      'shopify-oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    )

    const interval = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(interval)
        queryClient.invalidateQueries({ queryKey: ['stores'] })
        toast.success('Store connected!')
      }
    }, 500)
  }

  return { initiateOAuth }
}
```

### Step 10: Create Shared API Client (for x-store-id header)

`src/shared/lib/apiClient.ts`:

```typescript
'use client'

export function createAuthenticatedFetch(storeId?: string) {
  return async (url: string, options: RequestInit = {}) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
    
    if (storeId) {
      headers['x-store-id'] = storeId
    }
    
    return fetch(url, {
      ...options,
      headers,
    })
  }
}

// Hook version
import { useCurrentStore } from '@/features/auth'

export function useAuthenticatedFetch() {
  const { currentStore } = useCurrentStore()
  
  return (url: string, options: RequestInit = {}) => {
    return createAuthenticatedFetch(currentStore?.id)(url, options)
  }
}
```

### Step 11-14: Create Auth Components

(Same as previous plan - AuthModal, MFAModal, update-password page)

### Step 15: Update Auth Index Exports

`src/features/auth/index.ts`:

```typescript
// Hooks
export { useAuth } from './hooks/useAuth'
export { useSignup, useLogin, useLogout, useMagicLink, usePasswordReset } from './hooks/useAuthMutations'
export { useStores, useCurrentStore } from './hooks/useStores'
export { useShopifyOAuth } from './hooks/useShopifyOAuth'

// Components
export { AuthModal } from './components/AuthModal'
export { MFAModal } from './components/MFAModal'

// Types
export type * from './types'
```

---

## STAGE 3: Security API Routes & Middleware

### Steps 16-19: Create Auth Security Routes

(check-login-attempts, track-failed-login, log-event - same as previous plan)

### Step 20: Rewrite Shopify OAuth Callback

(Same as previous plan with encryption)

### Step 21: Create Middleware

(Same as previous plan)

### Step 22: Create Security Settings Page  

(Same as previous plan with QR code download)

---

## STAGE 4: Gradual API Route Migration

### Step 23: Test with ONE API Route

Pick `/api/products/route.ts`:

```typescript
import { requireAuth, requireStore } from '@/shared/lib/apiAuth'

export async function GET(request: NextRequest) {
  // Feature flag check
  if (process.env.USE_NEW_AUTH !== 'true') {
    // Fall back to old auth (import from supabase.old.ts)
    // ...existing code
    return
  }

  // New auth
  const { user, store, error } = await requireStore(request)
  if (error) return error
  
  // Rest of logic...
}
```

Test thoroughly before proceeding.

### Step 24-27: Migrate Remaining Routes in Batches

- Products routes
- Pricing routes
- Analytics routes  
- Settings routes
- Shopify routes

---

## STAGE 5: Frontend Switchover

### Step 28: Enable Feature Flag

Change `.env.local`:

```
USE_NEW_AUTH=true
```

Test thoroughly. Monitor for errors.

### Step 29: Update Landing Page

Rename old page, create new one

### Step 30: Monitor & Cleanup

After 1 week of stable operation:

- Delete old auth files
- Remove feature flags
- Remove supabase.old.ts

---

## Testing Checklist

(Same as previous plan)

## Complete File List

(Same as previous plan with additions)

### To-dos

- [ ] Create migration with Supabase Auth integration, token encryption, security tables, RLS policies, and triggers
- [ ] Configure Supabase Dashboard: enable email/magic links, MFA, set password rules, configure SMTP
- [ ] Delete old auth files: login route, session route, old useAuth, LoginForm, services folder
- [ ] Rewrite supabase.ts with SSR clients for browser/server/API/middleware/admin
- [ ] Create useAuth (React Query session), useAuthMutations (signup/login/logout), useStores (React Query)
- [ ] Create AuthModal (all auth modes), MFAModal (auto-challenge), update-password page
- [ ] Rewrite landing page with modal auth and Shopify OAuth primary CTA
- [ ] Create useShopifyOAuth hook with popup pattern, rewrite callback with encryption and Supabase Auth
- [ ] Create apiAuth.ts with requireAuth/requireStore, create security API routes (check-attempts, track-failed, log-event)
- [ ] Create middleware with security headers and protected route checks
- [ ] Create security settings page with MFA setup dialog
- [ ] Add requireAuth() to ALL existing API routes (products, pricing, analytics, settings, shopify)
- [ ] Complete testing checklist: auth flows, security features, RLS policies, encryption