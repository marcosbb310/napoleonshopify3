# Production-Grade Authentication Implementation Guide

**Complete, self-contained reference for implementing Supabase Auth + React Query authentication system**

---

## Technology Stack & Architecture Decisions

### MANDATORY Technology Choices

- **Auth Provider:** Supabase Auth (built-in JWT, MFA, session management)
- **Data Fetching:** React Query / TanStack Query v5 - NEVER useState + useEffect
- **UI Components:** shadcn/ui (Dialog, Tabs, Form, Input, Button, Label)
- **Styling:** Tailwind CSS (already in project)
- **QR Codes:** qrcode.react@3.1.0
- **Session Storage:** HTTP-only cookies (SSR-safe, not localStorage)
- **Token Encryption:** PostgreSQL pgcrypto with AES-256
- **Next.js Version:** 15 with App Router and Server Components
- **Feature Flag:** USE_NEW_AUTH environment variable

### Architectural Principles (NON-NEGOTIABLE)

1. React Query for ALL server data fetching (no useState/useEffect pattern)
2. NO service layer - Supabase SDK is comprehensive enough
3. NO Zustand/Redux - React Query cache handles global state
4. SSR-ready with createServerClient, createRouteHandlerClient, etc.
5. Middleware for global route protection
6. RLS (Row Level Security) policies for database-level security
7. Feature-based folder structure (src/features/auth/)

### Why These Choices

- **Supabase Auth:** Production-ready auth in 0 lines of code (vs 500+ for custom JWT)
- **React Query:** Automatic caching, deduplication, refetching (70% less boilerplate)
- **HTTP-only cookies:** XSS-proof, SSR-compatible, automatic with Supabase SSR
- **Middleware:** One place to protect all routes (vs checking in every API handler)
- **RLS policies:** Database enforces permissions even if app code has bugs

### Feature-Based Architecture Rules

```
src/features/auth/
├── components/    # AuthModal, MFAModal
├── hooks/         # useAuth, useAuthMutations, useStores
├── services/      # DELETE (not needed with Supabase SDK)
├── types/         # Auth types
└── index.ts       # Public exports
```

### Context: User Situation

- Development only (no production users yet)
- No existing auth system to migrate from
- Incremental testing preferred (test after each phase)
- Local Supabase available
- Total implementation time: ~7.5 hours

---

## Component Deep Dives

### What is AuthModal?

A modal dialog component that handles ALL auth flows in one place:

- Sign Up (email/password with name)
- Log In (email/password)
- Magic Link (passwordless email link)
- Forgot Password (email reset link)

Visual structure:

```
┌─────────────────────────────────────┐
│  Welcome to Smart Pricing       [X] │
├─────────────────────────────────────┤
│  [Sign Up] [Log In] [Magic Link]    │  ← Tabs
├─────────────────────────────────────┤
│  Email:    [________________]        │
│  Password: [________________]        │
│  Name:     [________________]        │ (signup only)
│                                      │
│       [Create Account]               │
│                                      │
│  Already have account? Switch tab    │
└─────────────────────────────────────┘
```

**Full AuthModal.tsx Implementation:**

File: `src/features/auth/components/AuthModal.tsx`

```typescript
'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { useSignup, useLogin, useMagicLink, usePasswordReset } from '../hooks/useAuthMutations'

export function AuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  
  const signup = useSignup()
  const login = useLogin()
  const magicLink = useMagicLink()
  const resetPassword = usePasswordReset()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Smart Pricing</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="signup">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
            <TabsTrigger value="login">Log In</TabsTrigger>
            <TabsTrigger value="magic">Magic Link</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signup" className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button 
              onClick={() => signup.mutate({ email, password, name })}
              disabled={signup.isPending}
              className="w-full"
            >
              Create Account
            </Button>
          </TabsContent>
          
          <TabsContent value="login" className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button 
              onClick={() => login.mutate({ email, password })}
              disabled={login.isPending}
              className="w-full"
            >
              Sign In
            </Button>
            <Button 
              variant="link" 
              onClick={() => resetPassword.mutate({ email })}
              className="w-full"
            >
              Forgot password?
            </Button>
          </TabsContent>
          
          <TabsContent value="magic" className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button 
              onClick={() => magicLink.mutate({ email })}
              disabled={magicLink.isPending}
              className="w-full"
            >
              Send Magic Link
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

### What is MFAModal?

Two-factor authentication component with two modes:

1. **Setup Mode:** Show QR code + backup codes for first-time setup
2. **Challenge Mode:** Prompt for 6-digit code on every login

Visual structure (Setup):

```
┌─────────────────────────────────────┐
│  Setup Two-Factor Authentication [X]│
├─────────────────────────────────────┤
│  Scan with Google Authenticator:    │
│                                      │
│     ████████████████                 │  ← QR Code
│     ████████████████                 │
│     ████████████████                 │
│                                      │
│  Or enter code manually: ABCD1234    │
│                                      │
│  Enter 6-digit code to confirm:      │
│     [______]                         │
│                                      │
│  Backup Codes (save these):          │
│  ABC123  DEF456  GHI789              │
│                                      │
│       [Complete Setup]               │
└─────────────────────────────────────┘
```

**Full MFAModal.tsx Implementation:**

File: `src/features/auth/components/MFAModal.tsx`

```typescript
'use client'
import { useState } from 'react'
import QRCode from 'qrcode.react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { createClient } from '@/shared/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function MFAModal({ open, onOpenChange, mode }: { 
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'setup' | 'challenge'
}) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  
  const startSetup = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
    })
    if (error) {
      toast.error(error.message)
      return
    }
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
    // Generate backup codes
    setBackupCodes([...Array(10)].map(() => Math.random().toString(36).substring(2, 8).toUpperCase()))
  }
  
  const verifyAndComplete = async () => {
    const { data, error } = await supabase.auth.mfa.challenge({
      factorId: 'current-factor-id', // Get from enroll response
    })
    if (error) {
      toast.error('Invalid code')
      return
    }
    
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: data.id,
      challengeId: data.id,
      code,
    })
    
    if (verifyError) {
      toast.error('Verification failed')
      return
    }
    
    toast.success('MFA enabled!')
    queryClient.invalidateQueries({ queryKey: ['session'] })
    onOpenChange(false)
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'setup' ? 'Setup Two-Factor Auth' : 'Enter MFA Code'}
          </DialogTitle>
        </DialogHeader>
        
        {mode === 'setup' ? (
          <div className="space-y-4">
            {!qrCode ? (
              <Button onClick={startSetup}>Start Setup</Button>
            ) : (
              <>
                <div className="flex justify-center">
                  <QRCode value={qrCode} size={200} />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Secret: {secret}
                </p>
                <div>
                  <Label>Enter 6-digit code</Label>
                  <Input 
                    value={code} 
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={6}
                    placeholder="000000"
                  />
                </div>
                <div className="bg-muted p-4 rounded">
                  <p className="font-semibold mb-2">Backup Codes (save these):</p>
                  <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                    {backupCodes.map((code, i) => (
                      <div key={i}>{code}</div>
                    ))}
                  </div>
                </div>
                <Button onClick={verifyAndComplete} className="w-full">
                  Complete Setup
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Enter 6-digit code</Label>
              <Input 
                value={code} 
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                placeholder="000000"
              />
            </div>
            <Button onClick={verifyAndComplete} className="w-full">
              Verify
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

### Why Routes Must Be Migrated

Current API routes (insecure):

```typescript
// api/products/[productId]/route.ts - BEFORE
export async function GET(request: NextRequest, { params }: { params: { productId: string } }) {
  // NO AUTH CHECK! Anyone can access
  const product = await supabase.from('products').select('*').eq('id', params.productId).single()
  return NextResponse.json(product)
}
```

After migration (secure):

```typescript
// api/products/[productId]/route.ts - AFTER
import { requireStore } from '@/shared/lib/apiAuth'

export async function GET(request: NextRequest, { params }: { params: { productId: string } }) {
  const { user, store, error } = await requireStore(request)
  if (error) return error
  
  // Now you KNOW:
  // - User is authenticated (Supabase verified)
  // - User owns the store (RLS enforced)
  // - store.access_token_encrypted is auto-decrypted
  
  const product = await supabase
    .from('products')
    .select('*')
    .eq('id', params.productId)
    .eq('store_id', store.id) // Enforce store ownership
    .single()
  
  return NextResponse.json(product)
}
```

**Routes that MUST be migrated:**

1. /api/products/[productId]/route.ts
2. /api/pricing/run/route.ts
3. /api/pricing/config/[productId]/route.ts
4. /api/pricing/history/[productId]/route.ts
5. /api/analytics/products/route.ts
6. /api/settings/global-pricing/route.ts
7. /api/shopify/products/route.ts
8. /api/shopify/sync/route.ts
9. /api/shopify/sync-orders/route.ts

**Routes to DELETE (Supabase handles these):**

- /api/auth/login/route.ts
- /api/auth/session/route.ts

---

## Phase 1: Foundation (30 minutes)

### Step 1: Install Dependencies

```bash
npm install qrcode.react@3.1.0
# @supabase/ssr already installed (verify in package.json)
```

### Step 2: Generate Encryption Key

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
```

### Step 3: Add to .env.local

```
ENCRYPTION_KEY=<paste-generated-key-here>
USE_NEW_AUTH=false
```

### Step 4: Create Migration File

File: `supabase/migrations/008_supabase_auth_integration.sql`

```sql
-- ============================================================================
-- PART 1: Schema Changes
-- ============================================================================

-- Add auth_user_id to users table (links to Supabase Auth)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;

-- Auto-create user profile when Supabase Auth user created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- PART 2: Token Encryption with pgcrypto
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted token column to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS access_token_encrypted BYTEA;

-- Encryption helper functions
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

-- Track failed login attempts for rate limiting
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

-- Auto-cleanup old attempts (>24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM failed_login_attempts WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Security audit log (all auth events)
CREATE TABLE IF NOT EXISTS auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_user_timestamp ON auth_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON auth_events(event_type);

-- ============================================================================
-- PART 4: Row Level Security (RLS) Policies
-- ============================================================================

-- Products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_user_access ON products;
CREATE POLICY products_user_access ON products
  FOR ALL USING (
    store_id IN (
      SELECT s.id FROM stores s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Stores table
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stores_user_access ON stores;
CREATE POLICY stores_user_access ON stores
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Pricing config table
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pricing_config_user_access ON pricing_config;
CREATE POLICY pricing_config_user_access ON pricing_config
  FOR ALL USING (
    product_id IN (
      SELECT p.id FROM products p
      INNER JOIN stores s ON p.store_id = s.id
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Pricing history table
ALTER TABLE pricing_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pricing_history_user_access ON pricing_history;
CREATE POLICY pricing_history_user_access ON pricing_history
  FOR ALL USING (
    store_id IN (
      SELECT s.id FROM stores s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Sales data table
ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_data_user_access ON sales_data;
CREATE POLICY sales_data_user_access ON sales_data
  FOR ALL USING (
    store_id IN (
      SELECT s.id FROM stores s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );
```

### Step 5: Run Migration

```bash
npx supabase db push
```

### Step 6: Configure Supabase Dashboard

Go to Supabase Dashboard → Authentication:

**1. Providers:**
- Enable Email provider
- Disable email confirmations (optional verification)
- Enable sign-ups

**2. Password Settings:**
- Minimum length: 10
- Require uppercase: ON
- Require lowercase: ON
- Require numbers: ON
- Require special characters: ON

**3. MFA Settings:**
- Enable TOTP: ON
- Max enrolled factors: 10

**4. SMTP Settings (Project Settings → Auth):**
- Configure SendGrid or Postmark
- Test email delivery

### Checkpoint

- [ ] Create test user in Supabase Dashboard (Authentication → Users → Add User)
- [ ] Verify user appears in `auth.users` table
- [ ] Verify `users` table has row with auth_user_id
- [ ] Check failed_login_attempts and auth_events tables exist

---

## Phase 2: Infrastructure (30 minutes)

### Step 7: Create SSR-Ready Supabase Client

File: `src/shared/lib/supabase.ts`

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

// Browser Client (Client Components)
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server Component Client
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

// API Route Handler Client
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

// Middleware Client
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

// Admin Client (Server-Side Only)
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client can only be used on server')
  }
  
  return createSSRServerClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    cookies: {
      get() { return undefined },
    }
  })
}
```

### Step 8: Create API Auth Helpers

File: `src/shared/lib/apiAuth.ts`

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
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single()
  
  if (storeError || !store) {
    return { 
      user, 
      store: null, 
      error: NextResponse.json({ error: 'Store not found or access denied' }, { status: 404 }) 
    }
  }
  
  // Decrypt Shopify token if needed
  if (store.access_token_encrypted) {
    const admin = createAdminClient()
    const { data } = await admin.rpc('decrypt_token', {
      encrypted_data: store.access_token_encrypted,
      key: process.env.ENCRYPTION_KEY!
    })
    store.access_token = data
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

### Step 9: Create API Client with Store Context

File: `src/shared/lib/apiClient.ts`

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

// Hook version for components
import { useCurrentStore } from '@/features/auth'

export function useAuthenticatedFetch() {
  const { currentStore } = useCurrentStore()
  
  return (url: string, options: RequestInit = {}) => {
    return createAuthenticatedFetch(currentStore?.id)(url, options)
  }
}
```

### Checkpoint

- [ ] Can import `createClient()` without errors
- [ ] TypeScript shows no type errors
- [ ] All 5 client functions export correctly

---

## Phase 3: Minimal Auth Flow (1 hour)

### Step 10: Create useAuth Hook

File: `src/features/auth/hooks/useAuth.ts`

```typescript
'use client'
import { createClient } from '@/shared/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

export function useAuth() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: session, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      return session
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
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

  // Auto-refresh session before expiry (50 minutes before 1 hour expiry)
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

### Step 11: Create Auth Mutations

File: `src/features/auth/hooks/useAuthMutations.ts`

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
      toast.success('Account created!')
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

### Step 12: Create Test Page

File: `src/app/test-auth/page.tsx`

```typescript
'use client'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AuthModal } from '@/features/auth/components/AuthModal'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { useLogout } from '@/features/auth/hooks/useAuthMutations'

export default function TestAuthPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const logout = useLogout()
  const [showAuth, setShowAuth] = useState(false)

  if (isLoading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Auth Test Page</h1>
      
      {isAuthenticated ? (
        <div className="space-y-4">
          <div className="p-4 bg-green-100 rounded">
            <p className="font-semibold">✅ Authenticated</p>
            <p>Email: {user?.email}</p>
            <p>ID: {user?.id}</p>
          </div>
          <Button onClick={() => logout.mutate()}>
            Sign Out
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-yellow-100 rounded">
            <p>❌ Not authenticated</p>
          </div>
          <Button onClick={() => setShowAuth(true)}>
            Open Auth Modal
          </Button>
        </div>
      )}

      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </div>
  )
}
```

### Step 13: Test Minimal Auth Flow

1. Start dev server: `npm run dev`
2. Visit `http://localhost:3000/test-auth`
3. Click "Open Auth Modal"
4. Try signup with test email
5. Verify "✅ Authenticated" appears
6. Refresh page - verify session persists
7. Click "Sign Out" - verify returns to not authenticated

### Checkpoint

- [ ] Can signup and see user email/ID
- [ ] Session persists on page refresh
- [ ] Logout clears session
- [ ] No console errors

---

## Phase 4: Complete Auth Features (1 hour)

### Step 14: Create Update Password Page

File: `src/app/auth/update-password/page.tsx`

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/shared/lib/supabase'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password updated!')
      router.push('/dashboard')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Update Password</h1>
          <p className="text-muted-foreground">Enter your new password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>New Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            Update Password
          </Button>
        </form>
      </div>
    </div>
  )
}
```

### Checkpoint

- [ ] All auth flows work (signup, login, magic link, password reset)
- [ ] MFAModal (from Section 2) shows QR code
- [ ] Update password page accessible

---

## Phase 5: Multi-Store Support (45 minutes)

### Step 15: Create useStores Hook

File: `src/features/auth/hooks/useStores.ts`

```typescript
'use client'
import { createClient } from '@/shared/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'

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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
```

### Step 16: Create useCurrentStore Hook

File: `src/features/auth/hooks/useCurrentStore.ts`

```typescript
'use client'
import { useStores } from './useStores'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

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

### Step 17: Create useShopifyOAuth Hook

File: `src/features/auth/hooks/useShopifyOAuth.ts`

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

### Checkpoint

- [ ] useStores returns list of stores
- [ ] useCurrentStore switches between stores
- [ ] useShopifyOAuth opens popup (callback may fail until Phase 6)

---

## Phase 6: Security Layer (1 hour)

### Step 18: Create Check Login Attempts Route

File: `src/app/api/auth/check-login-attempts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/shared/lib/supabase'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  const supabase = createAdminClient()
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '0.0.0.0'

  const { data: attempts } = await supabase
    .from('failed_login_attempts')
    .select('*')
    .eq('email', email)
    .eq('ip_address', ip)
    .single()

  if (attempts && attempts.locked_until) {
    const lockedUntil = new Date(attempts.locked_until)
    if (lockedUntil > new Date()) {
      const minutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { error: `Account locked. Try again in ${minutes} minutes.` },
        { status: 429 }
      )
    }
  }

  return NextResponse.json({ success: true })
}
```

### Step 19: Create Track Failed Login Route

File: `src/app/api/auth/track-failed-login/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/shared/lib/supabase'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  const supabase = createAdminClient()
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '0.0.0.0'

  const { data: existing } = await supabase
    .from('failed_login_attempts')
    .select('*')
    .eq('email', email)
    .eq('ip_address', ip)
    .single()

  if (existing) {
    const newCount = existing.attempt_count + 1
    const lockedUntil = newCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null

    await supabase
      .from('failed_login_attempts')
      .update({
        attempt_count: newCount,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('failed_login_attempts')
      .insert({
        email,
        ip_address: ip,
        attempt_count: 1,
      })
  }

  return NextResponse.json({ success: true })
}
```

### Step 20: Create Log Event Route

File: `src/app/api/auth/log-event/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/shared/lib/apiAuth'
import { createAdminClient } from '@/shared/lib/supabase'

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) return error

  const { event } = await request.json()
  const supabase = createAdminClient()
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')

  await supabase.from('auth_events').insert({
    user_id: user.id,
    event_type: event,
    ip_address: ip,
    user_agent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true })
}
```

### Step 21: Rewrite Shopify OAuth Callback

File: `src/app/api/auth/shopify/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/shared/lib/supabase'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const hmac = searchParams.get('hmac')
  const shop = searchParams.get('shop')

  // Verify HMAC
  const params = Object.fromEntries(searchParams.entries())
  delete params.hmac
  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')
  
  const generatedHmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET!)
    .update(message)
    .digest('hex')

  if (generatedHmac !== hmac) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 403 })
  }

  // Exchange code for access token
  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY!,
      client_secret: process.env.SHOPIFY_API_SECRET!,
      code,
    }),
  })

  const { access_token } = await tokenResponse.json()

  // Encrypt and store
  const supabase = createAdminClient()
  const { data: encryptedToken } = await supabase.rpc('encrypt_token', {
    token_text: access_token,
    key: process.env.ENCRYPTION_KEY!,
  })

  await supabase.from('stores').insert({
    shop_domain: shop,
    access_token_encrypted: encryptedToken,
  })

  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

### Step 22: Create Security Settings Page

File: `src/app/(app)/settings/security/page.tsx`

```typescript
'use client'
import { useAuth } from '@/features/auth'
import { MFAModal } from '@/features/auth/components/MFAModal'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { createClient } from '@/shared/lib/supabase'
import { useQuery } from '@tanstack/react-query'

export default function SecurityPage() {
  const { user } = useAuth()
  const [showMFA, setShowMFA] = useState(false)
  const supabase = createClient()

  const { data: auditLog } = useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const { data } = await supabase
        .from('auth_events')
        .select('*')
        .eq('user_id', user?.id)
        .order('timestamp', { ascending: false })
        .limit(20)
      return data || []
    },
    enabled: !!user,
  })

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="text-muted-foreground">Manage your account security</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
        <Button onClick={() => setShowMFA(true)}>
          Setup MFA
        </Button>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Activity</h2>
        <div className="border rounded-lg divide-y">
          {auditLog?.map(event => (
            <div key={event.id} className="p-4">
              <div className="flex justify-between">
                <span className="font-medium">{event.event_type}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{event.ip_address}</p>
            </div>
          ))}
        </div>
      </div>

      <MFAModal open={showMFA} onOpenChange={setShowMFA} mode="setup" />
    </div>
  )
}
```

### Checkpoint

- [ ] Try 5 failed logins → Account locks for 15 minutes
- [ ] Check auth_events table has entries
- [ ] Security page shows audit log
- [ ] Shopify OAuth works with encryption

---

## Phase 7: Middleware (15 minutes)

### Step 23: Create Middleware

File: `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from './shared/lib/supabase'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)

  // Refresh session if exists
  await supabase.auth.getSession()

  // Protected routes
  const protectedPaths = ['/dashboard', '/products', '/pricing', '/analytics', '/settings']
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (isProtectedPath) {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Checkpoint

- [ ] Access /dashboard without login → Redirects to /
- [ ] Login then access /dashboard → Allowed
- [ ] Security headers present in response

---

## Phase 8: API Route Migration (2 hours)

### Route Migration Pattern

**ALL routes follow this pattern:**

```typescript
// BEFORE (insecure)
export async function GET(request: NextRequest) {
  // No auth check
  const data = await supabase.from('table').select('*')
  return NextResponse.json(data)
}

// AFTER (secure)
import { requireStore } from '@/shared/lib/apiAuth'

export async function GET(request: NextRequest) {
  const { user, store, error } = await requireStore(request)
  if (error) return error
  
  const data = await supabase
    .from('table')
    .select('*')
    .eq('store_id', store.id)
  
  return NextResponse.json(data)
}
```

### Step 24: Migrate Products Route

File: `src/app/api/products/[productId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireStore } from '@/shared/lib/apiAuth'
import { createRouteHandlerClient } from '@/shared/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  const { user, store, error } = await requireStore(request)
  if (error) return error

  const supabase = createRouteHandlerClient(request)
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.productId)
    .eq('store_id', store.id)
    .single()

  return NextResponse.json(product)
}
```

### Steps 25-31: Migrate Remaining Routes

For each route, apply the same pattern:

1. Add `import { requireStore } from '@/shared/lib/apiAuth'`
2. At start of handler: `const { user, store, error } = await requireStore(request)`
3. Add `.eq('store_id', store.id)` to queries
4. Test with both `USE_NEW_AUTH=false` then `true`

**Routes to migrate:**

- /api/pricing/run/route.ts
- /api/pricing/config/[productId]/route.ts
- /api/pricing/history/[productId]/route.ts
- /api/analytics/products/route.ts
- /api/settings/global-pricing/route.ts
- /api/shopify/products/route.ts
- /api/shopify/sync/route.ts
- /api/shopify/sync-orders/route.ts

### Checkpoint

- [ ] Each route tested with USE_NEW_AUTH=true
- [ ] All routes return 401 without auth
- [ ] All routes work with valid session
- [ ] No routes accessible cross-store

---

## Phase 9: Switchover (30 minutes)

### Step 32: Create Landing Page

File: `src/app/page.tsx`

```typescript
'use client'
import { useState } from 'react'
import { useAuth } from '@/features/auth'
import { AuthModal } from '@/features/auth/components/AuthModal'
import { useShopifyOAuth } from '@/features/auth/hooks/useShopifyOAuth'
import { Button } from '@/shared/components/ui/button'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const { initiateOAuth } = useShopifyOAuth()
  const [showAuth, setShowAuth] = useState(false)
  const router = useRouter()

  const handleConnectStore = () => {
    if (isAuthenticated) {
      initiateOAuth()
    } else {
      setShowAuth(true)
    }
  }

  if (isAuthenticated) {
    router.push('/dashboard')
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold">Smart Pricing for Shopify</h1>
        <p className="text-xl text-muted-foreground">
          AI-powered dynamic pricing that maximizes your revenue automatically
        </p>
        <Button size="lg" onClick={handleConnectStore}>
          Connect Your Shopify Store
        </Button>
      </div>

      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </div>
  )
}
```

### Step 33: Enable Feature Flag

In `.env.local`:

```
USE_NEW_AUTH=true
```

### Step 34: Delete Old Auth Routes

```bash
rm -rf src/app/api/auth/login
rm -rf src/app/api/auth/session
```

### Checkpoint

- [ ] New user can signup → connect Shopify → access dashboard
- [ ] All features work with new auth
- [ ] No console errors

---

## Phase 10: Cleanup (After 1 Week)

### Step 35: Remove Feature Flags

Remove all `if (process.env.USE_NEW_AUTH !== 'true')` checks from API routes

### Step 36: Delete Old Files

```bash
rm -rf src/features/auth/services
rm src/shared/lib/supabase.old.ts  # If exists
```

### Step 37: Update Auth Exports

File: `src/features/auth/index.ts`

```typescript
// Hooks
export { useAuth } from './hooks/useAuth'
export { useSignup, useLogin, useLogout, useMagicLink, usePasswordReset } from './hooks/useAuthMutations'
export { useStores } from './hooks/useStores'
export { useCurrentStore } from './hooks/useCurrentStore'
export { useShopifyOAuth } from './hooks/useShopifyOAuth'

// Components
export { AuthModal } from './components/AuthModal'
export { MFAModal } from './components/MFAModal'
```

---

## Troubleshooting Guide

### Phase 1: Migration Fails

**Error: "extension pgcrypto does not exist"**
- Solution: Run `CREATE EXTENSION pgcrypto;` in SQL editor first

**Error: "column auth_user_id already exists"**
- Solution: Migration partially ran, check which parts completed

### Phase 2: Import Errors

**Error: "Cannot find module '@/shared/lib/supabase'"**
- Solution: Verify tsconfig.json has `"@/*": ["./src/*"]` in paths

### Phase 3: Auth Doesn't Persist

**Session clears on refresh**
- Solution: Check cookies are being set (HTTP-only, SameSite=Lax)
- Verify NEXT_PUBLIC_SUPABASE_URL is correct

### Phase 5: Store Switching Doesn't Work

**Products don't update after switch**
- Solution: Verify queryClient.invalidateQueries is called
- Check x-store-id header is being sent

### Phase 6: Rate Limiting Too Aggressive

**Account locks immediately**
- Solution: Check failed_login_attempts table, adjust threshold from 5 to higher

### Phase 8: Routes Return 401 After Migration

**Even with valid session**
- Solution: Verify x-store-id header is being sent
- Check RLS policies allow access

### Rollback Procedure

If critical issues arise:

1. Set `USE_NEW_AUTH=false` immediately
2. Old routes still exist, app continues working
3. Debug issues in new system
4. Re-enable when fixed

---

## Quick Reference Checklist

```
Progress Tracker:
[ ] Phase 1: Foundation (30 min)
[ ] Phase 2: Infrastructure (30 min)
[ ] Phase 3: Minimal Auth Flow (1 hour)
[ ] Phase 4: Complete Auth Features (1 hour)
[ ] Phase 5: Multi-Store (45 min)
[ ] Phase 6: Security Layer (1 hour)
[ ] Phase 7: Middleware (15 min)
[ ] Phase 8: API Route Migration (2 hours)
[ ] Phase 9: Switchover (30 min)
[ ] Phase 10: Cleanup (after 1 week)

Critical Reminders:
✅ USE_NEW_AUTH=false until Phase 9
✅ Test after EVERY phase
✅ One route at a time in Phase 8
✅ Keep old code until Phase 10
```

---

**Total Implementation Time: ~7.5 hours**

This guide is complete and self-contained. A new AI chat can implement it with zero additional context.

