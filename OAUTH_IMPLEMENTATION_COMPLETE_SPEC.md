# BULLETPROOF OAUTH IMPLEMENTATION - COMPLETE SPECIFICATION

**Version**: 1.0  
**Date**: 2025-01-XX  
**Project**: Napoleon Shopify Smart Pricing  
**Purpose**: Complete, unambiguous specification for OAuth 2.0 + PKCE implementation

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema](#database-schema)
4. [TypeScript Type Definitions](#typescript-type-definitions)
5. [Environment Configuration](#environment-configuration)
6. [Phase 1: Database Infrastructure](#phase-1-database-infrastructure)
7. [Phase 2: Core Security Services](#phase-2-core-security-services)
8. [Phase 3: Shop Validation](#phase-3-shop-validation)
9. [Phase 4: OAuth API Routes](#phase-4-oauth-api-routes)
10. [Phase 5: UI Components](#phase-5-ui-components)
11. [Phase 6: React Query Hooks](#phase-6-react-query-hooks)
12. [Phase 7: Error Handling](#phase-7-error-handling)
13. [Phase 8: Integration](#phase-8-integration)
14. [Phase 9: Cleanup](#phase-9-cleanup)
15. [Phase 10: Testing](#phase-10-testing)
16. [Implementation Checklist](#implementation-checklist)

---

## EXECUTIVE SUMMARY

### What We're Building

A secure, user-friendly OAuth 2.0 system for connecting Shopify stores to the Smart Pricing app.

### Two-Layer Authentication

1. **User Authentication** (Already Implemented)
   - Uses: Supabase Auth
   - Purpose: Users create accounts and login to YOUR app
   - Method: Email/password + optional Google/Shopify OAuth
   - Location: `src/features/auth/`

2. **Store Connection** (This Implementation)
   - Uses: Shopify OAuth 2.0 + PKCE
   - Purpose: Authenticated users connect their Shopify stores
   - Method: OAuth redirect flow with enhanced security
   - Location: `src/features/shopify-oauth/` (new)

### Key Requirements

- **Security**: PKCE, encrypted tokens, secure sessions, timing-safe HMAC
- **UX**: Single-screen modal (no page navigation required)
- **Performance**: Parallel operations, background sync, caching
- **Architecture**: Feature-based structure, React Query for data fetching
- **Zero Breaking Changes**: Works alongside existing code

### User Flow

```
1. User is logged in (via Supabase Auth)
2. User clicks "Connect Store" in Settings
3. Modal opens with shop domain input
4. User enters "mystore.myshopify.com"
5. Real-time validation (green checkmark)
6. User sees permission preview
7. User clicks "Connect"
8. Redirects to Shopify OAuth
9. User authorizes on Shopify
10. Redirects back to app
11. Tokens encrypted and stored
12. Webhooks registered
13. Products sync in background
14. Success message shown
```

---

## ARCHITECTURE OVERVIEW

### Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Auth**: Supabase Auth (existing)
- **Database**: PostgreSQL (Supabase)
- **Data Fetching**: React Query v5 (existing)
- **UI**: shadcn/ui + Tailwind CSS (existing)
- **Encryption**: PostgreSQL pgcrypto (existing)
- **TypeScript**: Strict mode

### Project Structure

```
napoleonshopify3/
├── supabase/
│   └── migrations/
│       └── 012_oauth_enhancements.sql (NEW)
├── src/
│   ├── features/
│   │   ├── auth/ (existing - Supabase Auth)
│   │   ├── shopify-integration/ (existing - store management)
│   │   └── shopify-oauth/ (NEW - OAuth flow)
│   │       ├── components/
│   │       │   ├── StoreConnectionModal.tsx
│   │       │   ├── ShopDomainInput.tsx
│   │       │   ├── PermissionPreview.tsx
│   │       │   ├── OAuthProgress.tsx
│   │       │   └── ConnectionSuccess.tsx
│   │       ├── hooks/
│   │       │   ├── useOAuthFlow.ts
│   │       │   ├── useOAuthSession.ts
│   │       │   └── useShopValidation.ts
│   │       ├── services/
│   │       │   ├── sessionService.ts
│   │       │   ├── tokenService.ts
│   │       │   └── shopValidationService.ts
│   │       ├── utils/
│   │       │   ├── errorHandler.ts
│   │       │   └── retry.ts
│   │       ├── types/
│   │       │   └── index.ts
│   │       └── index.ts
│   ├── shared/
│   │   └── lib/
│   │       └── pkce.ts (NEW)
│   └── app/
│       └── api/
│           └── auth/
│               └── shopify/
│                   └── v2/ (NEW)
│                       ├── initiate/
│                       │   └── route.ts
│                       └── callback/
│                           └── route.ts
```

### Existing Code to Integrate With

1. **Supabase Client** (`src/shared/lib/supabase.ts`)
   - `createClient()` - Browser client
   - `createRouteHandlerClient(request)` - API routes
   - `createAdminClient()` - Server-side admin operations

2. **Auth Hook** (`src/features/auth/hooks/useAuth.ts`)
   - Returns: `{ user, session, isLoading, isAuthenticated }`

3. **Stores Hook** (`src/features/shopify-integration/hooks/useStores.ts`)
   - Returns: `{ stores, isLoading, testConnection, disconnectStore }`

4. **Settings Page** (`src/app/(app)/settings/page.tsx`)
   - Currently uses old `useShopifyOAuth` hook (will replace)

---

## DATABASE SCHEMA

### Existing Tables (DO NOT MODIFY)

#### 1. auth.users (Supabase Auth - Built-in)
```sql
-- Managed by Supabase, don't modify
-- Contains: id, email, encrypted_password, email_confirmed_at, etc.
```

#### 2. users (public schema)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  mfa_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. stores
```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_domain TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL, -- Keep for backward compatibility
  access_token_encrypted BYTEA, -- New encrypted version (use this)
  scope TEXT NOT NULL,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. products, failed_login_attempts, auth_events (existing)

### New Tables (CREATE THESE)

**File**: `napoleonshopify3/supabase/migrations/012_oauth_enhancements.sql`

#### Table 1: oauth_sessions

**Purpose**: Track OAuth flows with PKCE verifiers  
**Lifecycle**: Created on initiate, validated on callback, expires in 10 minutes  
**Cleanup**: Cron job marks expired sessions

```sql
CREATE TABLE oauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  code_verifier TEXT NOT NULL, -- 128 chars, base64url
  code_challenge TEXT NOT NULL, -- SHA256 hash, base64url
  state TEXT UNIQUE NOT NULL, -- UUID for CSRF protection
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- created_at + 10 minutes
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_oauth_sessions_state ON oauth_sessions(state);
CREATE INDEX idx_oauth_sessions_user_id ON oauth_sessions(user_id);
CREATE INDEX idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);
CREATE INDEX idx_oauth_sessions_status ON oauth_sessions(status) 
  WHERE status = 'pending';

COMMENT ON TABLE oauth_sessions IS 'OAuth 2.0 sessions with PKCE for Shopify store connections';
```

#### Table 2: shop_validation_cache

**Purpose**: Cache shop domain validation results  
**Lifecycle**: Expires after 24 hours  
**Cleanup**: Cron job deletes expired entries

```sql
CREATE TABLE shop_validation_cache (
  shop_domain TEXT PRIMARY KEY,
  is_valid BOOLEAN NOT NULL,
  validation_data JSONB, -- {error: string, errorCode: string, suggestion: string}
  validated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL -- validated_at + 24 hours
);

CREATE INDEX idx_shop_validation_expires ON shop_validation_cache(expires_at);

COMMENT ON TABLE shop_validation_cache IS 'Cache for shop domain validation (24h TTL)';
```

#### Table 3: oauth_error_log

**Purpose**: Track OAuth failures for debugging  
**Lifecycle**: Permanent (optional cleanup after 90 days)

```sql
CREATE TABLE oauth_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  shop_domain TEXT,
  error_type TEXT NOT NULL, -- Error code enum
  error_message TEXT NOT NULL,
  error_stack TEXT,
  request_data JSONB, -- Sanitized request data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oauth_errors_user ON oauth_error_log(user_id, created_at DESC);
CREATE INDEX idx_oauth_errors_type ON oauth_error_log(error_type);
CREATE INDEX idx_oauth_errors_created ON oauth_error_log(created_at DESC);

COMMENT ON TABLE oauth_error_log IS 'OAuth error tracking for debugging';
```

#### Table 4: webhook_registrations

**Purpose**: Track registered webhooks per store  
**Lifecycle**: Created on store connection, updated on triggers

```sql
CREATE TABLE webhook_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  webhook_id TEXT NOT NULL, -- Shopify's webhook ID
  topic TEXT NOT NULL, -- 'products/update', 'products/create', etc
  address TEXT NOT NULL, -- Webhook URL
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(store_id, topic)
);

CREATE INDEX idx_webhook_store ON webhook_registrations(store_id);
CREATE INDEX idx_webhook_topic ON webhook_registrations(topic);

COMMENT ON TABLE webhook_registrations IS 'Shopify webhook registrations per store';
```

#### Table 5: sync_status

**Purpose**: Track product sync operations  
**Lifecycle**: Upserted on each sync attempt  
**Note**: UNIQUE constraint ensures one sync per store

```sql
CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  products_synced INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(store_id) -- Only one sync per store at a time
);

CREATE INDEX idx_sync_status_store ON sync_status(store_id);
CREATE INDEX idx_sync_status_status ON sync_status(status);

COMMENT ON TABLE sync_status IS 'Product sync tracking (one active sync per store)';
```

### Database Functions

#### Cleanup Function 1: Expire OAuth Sessions

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE oauth_sessions 
  SET status = 'expired'
  WHERE expires_at < NOW() 
    AND status = 'pending';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_oauth_sessions IS 
  'Marks expired OAuth sessions (run via cron every 5 minutes)';
```

#### Cleanup Function 2: Delete Old Validation Cache

```sql
CREATE OR REPLACE FUNCTION cleanup_shop_validation_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shop_validation_cache 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_shop_validation_cache IS 
  'Deletes expired shop validation cache (run via cron daily)';
```

### Row Level Security (RLS) Policies

```sql
-- oauth_sessions: Users can only access their own sessions
ALTER TABLE oauth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY oauth_sessions_user_access ON oauth_sessions
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- shop_validation_cache: Public read, service role write
ALTER TABLE shop_validation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY shop_validation_public_read ON shop_validation_cache
  FOR SELECT USING (true);

CREATE POLICY shop_validation_service_write ON shop_validation_cache
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- oauth_error_log: Users see own errors, service role inserts
ALTER TABLE oauth_error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY oauth_errors_user_access ON oauth_error_log
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY oauth_errors_service_insert ON oauth_error_log
  FOR INSERT WITH CHECK (true);

-- webhook_registrations: Users access webhooks for their stores
ALTER TABLE webhook_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_registrations_user_access ON webhook_registrations
  FOR ALL USING (
    store_id IN (
      SELECT s.id FROM stores s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- sync_status: Users access sync status for their stores
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_status_user_access ON sync_status
  FOR ALL USING (
    store_id IN (
      SELECT s.id FROM stores s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );
```

---

## TYPESCRIPT TYPE DEFINITIONS

**File**: `napoleonshopify3/src/features/shopify-oauth/types/index.ts`

```typescript
// ============================================================================
// PKCE Types
// ============================================================================

export interface PKCEPair {
  codeVerifier: string; // 128 character random string (base64url)
  codeChallenge: string; // SHA256 hash of verifier (base64url)
}

// ============================================================================
// OAuth Session Types
// ============================================================================

export type OAuthSessionStatus = 'pending' | 'completed' | 'failed' | 'expired';

export interface OAuthSession {
  id: string;
  userId: string;
  shopDomain: string;
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  status: OAuthSessionStatus;
  errorMessage?: string;
  createdAt: Date;
  expiresAt: Date;
  completedAt?: Date;
}

export interface CreateOAuthSessionParams {
  userId: string;
  shopDomain: string;
  pkce: PKCEPair;
}

export interface OAuthSessionRow {
  id: string;
  user_id: string;
  shop_domain: string;
  code_verifier: string;
  code_challenge: string;
  state: string;
  status: OAuthSessionStatus;
  error_message: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
}

// ============================================================================
// Shop Validation Types
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  shopDomain: string; // Normalized domain (with .myshopify.com)
  error?: string;
  errorCode?: ValidationErrorCode;
  suggestion?: string; // User-friendly suggestion
}

export type ValidationErrorCode =
  | 'INVALID_FORMAT'
  | 'DOMAIN_NOT_FOUND'
  | 'DNS_LOOKUP_FAILED'
  | 'NOT_SHOPIFY_STORE'
  | 'NETWORK_ERROR';

export interface ShopValidationCache {
  shopDomain: string;
  isValid: boolean;
  validationData?: {
    error?: string;
    errorCode?: ValidationErrorCode;
    suggestion?: string;
  };
  validatedAt: Date;
  expiresAt: Date;
}

export interface ShopValidationCacheRow {
  shop_domain: string;
  is_valid: boolean;
  validation_data: Record<string, unknown> | null;
  validated_at: string;
  expires_at: string;
}

// ============================================================================
// Token Types
// ============================================================================

export interface TokenSet {
  accessToken: string;
  scope: string;
  expiresAt?: Date;
}

export interface EncryptedTokens {
  accessTokenEncrypted: Buffer;
  scope: string;
}

export interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
  expires_in?: number;
}

// ============================================================================
// OAuth Flow Types
// ============================================================================

export interface OAuthInitiateRequest {
  shopDomain: string;
}

export interface OAuthInitiateResponse {
  success: boolean;
  oauthUrl?: string;
  sessionId?: string;
  error?: string;
  errorCode?: OAuthErrorCode;
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
  shop: string;
  hmac: string;
  timestamp?: string;
  host?: string;
}

export interface OAuthCallbackResult {
  success: boolean;
  storeId?: string;
  shopDomain?: string;
  error?: string;
  errorCode?: OAuthErrorCode;
}

// ============================================================================
// Error Types
// ============================================================================

export type OAuthErrorCode =
  | 'INVALID_SHOP_DOMAIN'
  | 'SHOP_NOT_FOUND'
  | 'USER_NOT_AUTHENTICATED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'PKCE_VERIFICATION_FAILED'
  | 'HMAC_VERIFICATION_FAILED'
  | 'TOKEN_EXCHANGE_FAILED'
  | 'STORE_CREATION_FAILED'
  | 'WEBHOOK_REGISTRATION_FAILED'
  | 'ENCRYPTION_FAILED'
  | 'ACCESS_DENIED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface OAuthError extends Error {
  code: OAuthErrorCode;
  technicalMessage?: string;
  suggestion?: string;
  retryable: boolean;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestion?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface StoreConnectionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (storeId: string) => void;
}

export interface ShopDomainInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidation?: (result: ValidationResult) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export interface PermissionPreviewProps {
  shopDomain: string;
  scopes: string[];
}

export type OAuthProgressStatus = 
  | 'validating' 
  | 'redirecting' 
  | 'authorizing' 
  | 'connecting' 
  | 'syncing' 
  | 'success' 
  | 'error';

export interface OAuthProgressProps {
  step: number;
  totalSteps: number;
  status: OAuthProgressStatus;
  message?: string;
  error?: string;
}

export interface ConnectionSuccessProps {
  store: {
    id: string;
    shopDomain: string;
    installedAt: Date;
  };
  onContinue: () => void;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookRegistration {
  id: string;
  storeId: string;
  webhookId: string;
  topic: string;
  address: string;
  registeredAt: Date;
  lastTriggeredAt?: Date;
  triggerCount: number;
  isActive: boolean;
}

export interface WebhookRegistrationRow {
  id: string;
  store_id: string;
  webhook_id: string;
  topic: string;
  address: string;
  registered_at: string;
  last_triggered_at: string | null;
  trigger_count: number;
  is_active: boolean;
}

// ============================================================================
// Sync Status Types
// ============================================================================

export type SyncStatus = 'in_progress' | 'completed' | 'failed';

export interface StoreSyncStatus {
  id: string;
  storeId: string;
  status: SyncStatus;
  productsSynced: number;
  totalProducts: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface StoreSyncStatusRow {
  id: string;
  store_id: string;
  status: SyncStatus;
  products_synced: number;
  total_products: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

// ============================================================================
// Service Types
// ============================================================================

export interface OAuthSessionService {
  createSession(params: CreateOAuthSessionParams): Promise<OAuthSession>;
  validateSession(state: string): Promise<OAuthSession | null>;
  completeSession(sessionId: string, success: boolean, error?: string): Promise<void>;
  cleanupExpiredSessions(): Promise<number>;
}

export interface TokenService {
  encryptAndStoreTokens(
    userId: string,
    shopDomain: string,
    tokens: TokenSet
  ): Promise<string>; // Returns store ID
  getDecryptedTokens(storeId: string): Promise<TokenSet>;
}

export interface ShopValidationService {
  validateShopDomain(domain: string): Promise<ValidationResult>;
  getCachedValidation(domain: string): Promise<ValidationResult | null>;
  cacheValidation(domain: string, result: ValidationResult): Promise<void>;
}
```

---

## ENVIRONMENT CONFIGURATION

### Required Environment Variables

**File**: `.env.local`

```bash
# ============================================================================
# Supabase Configuration
# ============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============================================================================
# Shopify OAuth Configuration
# ============================================================================
SHOPIFY_API_KEY=your_shopify_api_key_from_partner_dashboard
SHOPIFY_API_SECRET=your_shopify_api_secret_from_partner_dashboard
SHOPIFY_SCOPES=read_products,write_products,read_orders
NEXT_PUBLIC_SHOPIFY_API_VERSION=2024-10

# ============================================================================
# App Configuration
# ============================================================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# ============================================================================
# Encryption Configuration
# ============================================================================
# IMPORTANT: Must be exactly 32 characters for AES-256
ENCRYPTION_KEY=your_32_character_encryption_key

# ============================================================================
# Optional: Rate Limiting
# ============================================================================
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

### Shopify Partner Dashboard Configuration

**CRITICAL**: These URLs must match exactly in Shopify Partner Dashboard

1. Go to: https://partners.shopify.com/
2. Navigate to: Apps → [Your App] → Configuration
3. Set:
   - **App URL**: `http://localhost:3000` (dev) or `https://yourdomain.com` (prod)
   - **Allowed redirection URL(s)**: 
     - `http://localhost:3000/api/auth/shopify/v2/callback` (dev)
     - `https://yourdomain.com/api/auth/shopify/v2/callback` (prod)

### Environment Validation

**File**: `src/shared/lib/validateEnv.ts` (already exists, add to it)

```typescript
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'ENCRYPTION_KEY',
  'NEXT_PUBLIC_APP_URL'
];

// Validate on app startup
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

// Validate ENCRYPTION_KEY length
if (process.env.ENCRYPTION_KEY?.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
}
```

---

## PHASE 1: DATABASE INFRASTRUCTURE

### Step 1.1: Create Migration File

**File**: `napoleonshopify3/supabase/migrations/012_oauth_enhancements.sql`

**Complete SQL** (copy this exactly):

```sql
-- ============================================================================
-- OAuth Enhancements Migration
-- Adds tables and functions for secure OAuth 2.0 + PKCE implementation
-- Version: 1.0
-- Date: 2025-01-XX
-- ============================================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE 1: oauth_sessions
-- Purpose: Track OAuth flows with PKCE verifiers
-- ============================================================================

CREATE TABLE oauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  state TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_oauth_sessions_state ON oauth_sessions(state);
CREATE INDEX idx_oauth_sessions_user_id ON oauth_sessions(user_id);
CREATE INDEX idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);
CREATE INDEX idx_oauth_sessions_status ON oauth_sessions(status) 
  WHERE status = 'pending';

COMMENT ON TABLE oauth_sessions IS 'OAuth 2.0 sessions with PKCE for Shopify store connections';
COMMENT ON COLUMN oauth_sessions.code_verifier IS 'PKCE code verifier - 128 character random string';
COMMENT ON COLUMN oauth_sessions.code_challenge IS 'SHA256 hash of code_verifier, base64url encoded';
COMMENT ON COLUMN oauth_sessions.state IS 'CSRF protection token, must match on callback';

-- ============================================================================
-- TABLE 2: shop_validation_cache
-- Purpose: Cache shop domain validation results
-- ============================================================================

CREATE TABLE shop_validation_cache (
  shop_domain TEXT PRIMARY KEY,
  is_valid BOOLEAN NOT NULL,
  validation_data JSONB,
  validated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_shop_validation_expires ON shop_validation_cache(expires_at);

COMMENT ON TABLE shop_validation_cache IS 'Cache for shop domain validation results (24 hour TTL)';

-- ============================================================================
-- TABLE 3: oauth_error_log
-- Purpose: Track OAuth failures for debugging and monitoring
-- ============================================================================

CREATE TABLE oauth_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  shop_domain TEXT,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  request_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oauth_errors_user ON oauth_error_log(user_id, created_at DESC);
CREATE INDEX idx_oauth_errors_type ON oauth_error_log(error_type);
CREATE INDEX idx_oauth_errors_created ON oauth_error_log(created_at DESC);

COMMENT ON TABLE oauth_error_log IS 'OAuth error tracking for debugging and monitoring';

-- ============================================================================
-- TABLE 4: webhook_registrations
-- Purpose: Track registered webhooks per store
-- ============================================================================

CREATE TABLE webhook_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  webhook_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  address TEXT NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(store_id, topic)
);

CREATE INDEX idx_webhook_store ON webhook_registrations(store_id);
CREATE INDEX idx_webhook_topic ON webhook_registrations(topic);

COMMENT ON TABLE webhook_registrations IS 'Shopify webhook registrations per store';

-- ============================================================================
-- TABLE 5: sync_status
-- Purpose: Track product sync operations
-- ============================================================================

CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  products_synced INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(store_id)
);

CREATE INDEX idx_sync_status_store ON sync_status(store_id);
CREATE INDEX idx_sync_status_status ON sync_status(status);

COMMENT ON TABLE sync_status IS 'Product sync operation tracking (one active sync per store)';

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE oauth_sessions 
  SET status = 'expired'
  WHERE expires_at < NOW() 
    AND status = 'pending';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_oauth_sessions IS 
  'Marks expired OAuth sessions (run via cron every 5 minutes)';

CREATE OR REPLACE FUNCTION cleanup_shop_validation_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shop_validation_cache 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_shop_validation_cache IS 
  'Deletes expired shop validation cache (run via cron daily)';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- oauth_sessions: Users can only access their own sessions
ALTER TABLE oauth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY oauth_sessions_user_access ON oauth_sessions
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- shop_validation_cache: Public read, service role write
ALTER TABLE shop_validation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY shop_validation_public_read ON shop_validation_cache
  FOR SELECT USING (true);

CREATE POLICY shop_validation_service_write ON shop_validation_cache
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- oauth_error_log: Users see own errors, service role inserts
ALTER TABLE oauth_error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY oauth_errors_user_access ON oauth_error_log
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY oauth_errors_service_insert ON oauth_error_log
  FOR INSERT WITH CHECK (true);

-- webhook_registrations: Users access webhooks for their stores
ALTER TABLE webhook_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_registrations_user_access ON webhook_registrations
  FOR ALL USING (
    store_id IN (
      SELECT s.id FROM stores s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- sync_status: Users access sync status for their stores
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_status_user_access ON sync_status
  FOR ALL USING (
    store_id IN (
      SELECT s.id FROM stores s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
```

### Step 1.2: Run Migration

```bash
# Option 1: Via Supabase Dashboard
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Paste the entire migration file
# 3. Click "Run"

# Option 2: Via Supabase CLI (if installed)
supabase db push
```

### Step 1.3: Verify Migration

```sql
-- Run these queries in Supabase SQL Editor to verify

-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'oauth_sessions', 
    'shop_validation_cache', 
    'oauth_error_log', 
    'webhook_registrations', 
    'sync_status'
  );

-- Should return 5 rows

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'oauth_sessions', 
    'shop_validation_cache', 
    'oauth_error_log', 
    'webhook_registrations', 
    'sync_status'
  );

-- All should have rowsecurity = true

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'cleanup_expired_oauth_sessions', 
    'cleanup_shop_validation_cache'
  );

-- Should return 2 rows
```

---

## PHASE 2: CORE SECURITY SERVICES

### Step 2.1: PKCE Implementation

**File**: `napoleonshopify3/src/shared/lib/pkce.ts`

```typescript
import crypto from 'crypto';

/**
 * PKCE (Proof Key for Code Exchange) Implementation
 * Adds security layer to OAuth 2.0 flow
 * 
 * Flow:
 * 1. Generate random code_verifier (128 chars)
 * 2. Create code_challenge = SHA256(code_verifier)
 * 3. Send code_challenge to OAuth provider
 * 4. Provider stores challenge
 * 5. On callback, send code_verifier
 * 6. Provider verifies SHA256(code_verifier) === stored challenge
 */

export interface PKCEPair {
  codeVerifier: string; // 128 character random string (base64url)
  codeChallenge: string; // SHA256 hash of verifier (base64url)
}

/**
 * Generate a PKCE code verifier and challenge pair
 * 
 * @returns PKCEPair with verifier and challenge
 * 
 * @example
 * const { codeVerifier, codeChallenge } = generatePKCEPair();
 * // Store codeVerifier securely
 * // Send codeChallenge in OAuth request
 */
export function generatePKCEPair(): PKCEPair {
  // Generate 128 character random string (base64url encoded)
  const codeVerifier = generateRandomString(128);
  
  // Create SHA256 hash of verifier (base64url encoded)
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}

/**
 * Verify that a code verifier matches a code challenge
 * Uses timing-safe comparison to prevent timing attacks
 * 
 * @param codeVerifier - The original code verifier
 * @param codeChallenge - The code challenge to verify against
 * @returns true if verifier matches challenge
 * 
 * @example
 * const isValid = verifyPKCE(storedVerifier, receivedChallenge);
 * if (!isValid) throw new Error('PKCE verification failed');
 */
export function verifyPKCE(
  codeVerifier: string, 
  codeChallenge: string
): boolean {
  // Recreate challenge from verifier
  const expectedChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  // Timing-safe comparison (prevents timing attacks)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedChallenge),
      Buffer.from(codeChallenge)
    );
  } catch {
    // timingSafeEqual throws if lengths don't match
    return false;
  }
}

/**
 * Generate a cryptographically secure random string
 * Uses URL-safe base64 encoding (base64url)
 * 
 * @param length - Desired length of the string
 * @returns Random string of specified length
 * 
 * @internal
 */
function generateRandomString(length: number): string {
  // Calculate bytes needed (base64url is ~1.33x longer than bytes)
  const bytesNeeded = Math.ceil(length * 0.75);
  
  // Generate random bytes
  const randomBytes = crypto.randomBytes(bytesNeeded);
  
  // Convert to base64url and trim to exact length
  return randomBytes
    .toString('base64url')
    .slice(0, length);
}

/**
 * Generate a secure state parameter for CSRF protection
 * 
 * @returns UUID v4 string
 * 
 * @example
 * const state = generateSecureState();
 * // Store state in session
 * // Verify state matches on callback
 */
export function generateSecureState(): string {
  return crypto.randomUUID();
}
```

### Step 2.2: OAuth Session Service

**File**: `napoleonshopify3/src/features/shopify-oauth/services/sessionService.ts`

```typescript
import { createAdminClient } from '@/shared/lib/supabase';
import { generateSecureState } from '@/shared/lib/pkce';
import type {
  OAuthSession,
  OAuthSessionRow,
  CreateOAuthSessionParams,
  PKCEPair,
} from '../types';

/**
 * OAuth Session Service
 * Manages OAuth sessions with PKCE verifiers
 * 
 * Responsibilities:
 * - Create new OAuth sessions
 * - Validate sessions on callback
 * - Mark sessions as completed/failed
 * - Cleanup expired sessions
 */

const SESSION_EXPIRY_MINUTES = 10;

/**
 * Create a new OAuth session
 * 
 * @param params - Session creation parameters
 * @returns Created OAuth session
 * @throws Error if session creation fails
 * 
 * @example
 * const session = await createSession({
 *   userId: user.id,
 *   shopDomain: 'mystore.myshopify.com',
 *   pkce: generatePKCEPair()
 * });
 */
export async function createSession(
  params: CreateOAuthSessionParams
): Promise<OAuthSession> {
  const supabase = createAdminClient();
  
  const state = generateSecureState();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MINUTES * 60 * 1000);
  
  const { data, error } = await supabase
    .from('oauth_sessions')
    .insert({
      user_id: params.userId,
      shop_domain: params.shopDomain,
      code_verifier: params.pkce.codeVerifier,
      code_challenge: params.pkce.codeChallenge,
      state,
      status: 'pending',
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to create OAuth session: ${error?.message}`);
  }
  
  return rowToSession(data as OAuthSessionRow);
}

/**
 * Validate an OAuth session by state parameter
 * 
 * @param state - The state parameter from OAuth callback
 * @returns OAuth session if valid, null if not found or expired
 * 
 * @example
 * const session = await validateSession(callbackParams.state);
 * if (!session) {
 *   throw new Error('Invalid or expired session');
 * }
 */
export async function validateSession(
  state: string
): Promise<OAuthSession | null> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('oauth_sessions')
    .select('*')
    .eq('state', state)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return rowToSession(data as OAuthSessionRow);
}

/**
 * Mark an OAuth session as completed or failed
 * 
 * @param sessionId - The session ID
 * @param success - Whether the OAuth flow succeeded
 * @param errorMessage - Optional error message if failed
 * 
 * @example
 * await completeSession(session.id, true);
 * // or
 * await completeSession(session.id, false, 'Token exchange failed');
 */
export async function completeSession(
  sessionId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const supabase = createAdminClient();
  
  const { error } = await supabase
    .from('oauth_sessions')
    .update({
      status: success ? 'completed' : 'failed',
      error_message: errorMessage || null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
  
  if (error) {
    console.error('Failed to complete OAuth session:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Cleanup expired OAuth sessions
 * Should be called periodically (e.g., via cron)
 * 
 * @returns Number of sessions marked as expired
 * 
 * @example
 * const expiredCount = await cleanupExpiredSessions();
 * console.log(`Marked ${expiredCount} sessions as expired`);
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase.rpc('cleanup_expired_oauth_sessions');
  
  if (error) {
    console.error('Failed to cleanup expired sessions:', error);
    return 0;
  }
  
  return data || 0;
}

/**
 * Convert database row to OAuthSession object
 * @internal
 */
function rowToSession(row: OAuthSessionRow): OAuthSession {
  return {
    id: row.id,
    userId: row.user_id,
    shopDomain: row.shop_domain,
    codeVerifier: row.code_verifier,
    codeChallenge: row.code_challenge,
    state: row.state,
    status: row.status,
    errorMessage: row.error_message || undefined,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}
```

### Step 2.3: Token Encryption Service

**File**: `napoleonshopify3/src/features/shopify-oauth/services/tokenService.ts`

```typescript
import { createAdminClient } from '@/shared/lib/supabase';
import type { TokenSet } from '../types';

/**
 * Token Encryption Service
 * Handles encryption and storage of Shopify access tokens
 * 
 * Uses PostgreSQL pgcrypto for encryption:
 * - Tokens are encrypted with AES-256
 * - Encryption key from environment variable
 * - Tokens never stored in plain text
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
}

/**
 * Encrypt and store Shopify access tokens
 * 
 * @param userId - The user ID
 * @param shopDomain - The Shopify shop domain
 * @param tokens - The token set to encrypt and store
 * @returns The created or updated store ID
 * @throws Error if encryption or storage fails
 * 
 * @example
 * const storeId = await encryptAndStoreTokens(
 *   user.id,
 *   'mystore.myshopify.com',
 *   { accessToken: 'shpat_...', scope: 'read_products,write_products' }
 * );
 */
export async function encryptAndStoreTokens(
  userId: string,
  shopDomain: string,
  tokens: TokenSet
): Promise<string> {
  const supabase = createAdminClient();
  
  // Encrypt the access token using PostgreSQL function
  const { data: encryptedToken, error: encryptError } = await supabase.rpc(
    'encrypt_token',
    {
      token_text: tokens.accessToken,
      key: ENCRYPTION_KEY,
    }
  );
  
  if (encryptError || !encryptedToken) {
    throw new Error(`Failed to encrypt token: ${encryptError?.message}`);
  }
  
  // Check if store already exists for this user
  const { data: existingStore } = await supabase
    .from('stores')
    .select('id')
    .eq('shop_domain', shopDomain)
    .eq('user_id', userId)
    .single();
  
  if (existingStore) {
    // Update existing store
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        access_token: tokens.accessToken, // Keep for backward compatibility
        access_token_encrypted: encryptedToken,
        scope: tokens.scope,
        last_synced_at: new Date().toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingStore.id);
    
    if (updateError) {
      throw new Error(`Failed to update store: ${updateError.message}`);
    }
    
    return existingStore.id;
  } else {
    // Create new store
    const { data: newStore, error: insertError } = await supabase
      .from('stores')
      .insert({
        user_id: userId,
        shop_domain: shopDomain,
        access_token: tokens.accessToken, // Keep for backward compatibility
        access_token_encrypted: encryptedToken,
        scope: tokens.scope,
        installed_at: new Date().toISOString(),
        is_active: true,
      })
      .select('id')
      .single();
    
    if (insertError || !newStore) {
      throw new Error(`Failed to create store: ${insertError?.message}`);
    }
    
    return newStore.id;
  }
}

/**
 * Get decrypted access tokens for a store
 * 
 * @param storeId - The store ID
 * @returns Decrypted token set
 * @throws Error if store not found or decryption fails
 * 
 * @example
 * const tokens = await getDecryptedTokens(storeId);
 * // Use tokens.accessToken for Shopify API calls
 */
export async function getDecryptedTokens(storeId: string): Promise<TokenSet> {
  const supabase = createAdminClient();
  
  const { data: store, error: fetchError } = await supabase
    .from('stores')
    .select('access_token_encrypted, scope')
    .eq('id', storeId)
    .single();
  
  if (fetchError || !store) {
    throw new Error(`Store not found: ${fetchError?.message}`);
  }
  
  // Decrypt the access token using PostgreSQL function
  const { data: decryptedToken, error: decryptError } = await supabase.rpc(
    'decrypt_token',
    {
      encrypted_data: store.access_token_encrypted,
      key: ENCRYPTION_KEY,
    }
  );
  
  if (decryptError || !decryptedToken) {
    throw new Error(`Failed to decrypt token: ${decryptError?.message}`);
  }
  
  return {
    accessToken: decryptedToken,
    scope: store.scope,
  };
}
```

---

## PHASE 3: SHOP VALIDATION

### Step 3.1: Shop Validation Service

**File**: `napoleonshopify3/src/features/shopify-oauth/services/shopValidationService.ts`

```typescript
import { createAdminClient } from '@/shared/lib/supabase';
import type { 
  ValidationResult, 
  ValidationErrorCode,
  ShopValidationCacheRow 
} from '../types';

/**
 * Shop Validation Service
 * Validates Shopify shop domains with caching
 * 
 * Validation steps:
 * 1. Format validation (must end with .myshopify.com)
 * 2. Check cache (24 hour TTL)
 * 3. DNS lookup to verify domain exists
 * 4. Cache result
 */

const CACHE_TTL_HOURS = 24;

/**
 * Validate a Shopify shop domain
 * 
 * @param domain - The shop domain to validate
 * @returns Validation result with normalized domain
 * 
 * @example
 * const result = await validateShopDomain('mystore');
 * // result.isValid = true
 * // result.shopDomain = 'mystore.myshopify.com'
 * 
 * const result2 = await validateShopDomain('invalid-shop');
 * // result2.isValid = false
 * // result2.error = 'Store not found'
 * // result2.suggestion = 'Check the spelling...'
 */
export async function validateShopDomain(
  domain: string
): Promise<ValidationResult> {
  // Step 1: Normalize domain
  const normalizedDomain = normalizeDomain(domain);
  
  // Step 2: Format validation
  const formatResult = validateFormat(normalizedDomain);
  if (!formatResult.isValid) {
    return formatResult;
  }
  
  // Step 3: Check cache
  const cachedResult = await getCachedValidation(normalizedDomain);
  if (cachedResult) {
    return cachedResult;
  }
  
  // Step 4: DNS lookup
  const dnsResult = await validateDNS(normalizedDomain);
  
  // Step 5: Cache result
  await cacheValidation(normalizedDomain, dnsResult);
  
  return dnsResult;
}

/**
 * Normalize shop domain
 * - Trim whitespace
 * - Convert to lowercase
 * - Add .myshopify.com if missing
 * 
 * @internal
 */
function normalizeDomain(domain: string): string {
  let normalized = domain.trim().toLowerCase();
  
  // Remove protocol if present
  normalized = normalized.replace(/^https?:\/\//, '');
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  // Add .myshopify.com if not present
  if (!normalized.includes('.myshopify.com')) {
    normalized = `${normalized}.myshopify.com`;
  }
  
  return normalized;
}

/**
 * Validate domain format
 * @internal
 */
function validateFormat(domain: string): ValidationResult {
  // Must end with .myshopify.com
  if (!domain.endsWith('.myshopify.com')) {
    return {
      isValid: false,
      shopDomain: domain,
      error: 'Invalid shop domain format',
      errorCode: 'INVALID_FORMAT',
      suggestion: 'Shop domain must end with .myshopify.com (e.g., mystore.myshopify.com)',
    };
  }
  
  // Extract shop name (part before .myshopify.com)
  const shopName = domain.replace('.myshopify.com', '');
  
  // Shop name must be at least 3 characters
  if (shopName.length < 3) {
    return {
      isValid: false,
      shopDomain: domain,
      error: 'Shop name too short',
      errorCode: 'INVALID_FORMAT',
      suggestion: 'Shop name must be at least 3 characters',
    };
  }
  
  // Shop name can only contain letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(shopName)) {
    return {
      isValid: false,
      shopDomain: domain,
      error: 'Invalid characters in shop name',
      errorCode: 'INVALID_FORMAT',
      suggestion: 'Shop name can only contain letters, numbers, and hyphens',
    };
  }
  
  return {
    isValid: true,
    shopDomain: domain,
  };
}

/**
 * Validate domain via DNS lookup
 * @internal
 */
async function validateDNS(domain: string): Promise<ValidationResult> {
  try {
    // Try to fetch the shop's homepage
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // If we get any response (even 404), the domain exists
    if (response.status === 404 || response.status === 403) {
      // Domain exists but might not be a Shopify store
      return {
        isValid: false,
        shopDomain: domain,
        error: 'Store not found',
        errorCode: 'DOMAIN_NOT_FOUND',
        suggestion: 'This domain exists but may not be a Shopify store. Check the spelling.',
      };
    }
    
    // 200-399 status codes indicate a valid store
    if (response.status >= 200 && response.status < 400) {
      return {
        isValid: true,
        shopDomain: domain,
      };
    }
    
    return {
      isValid: false,
      shopDomain: domain,
      error: 'Unable to verify store',
      errorCode: 'DNS_LOOKUP_FAILED',
      suggestion: 'Please check the domain and try again',
    };
  } catch (error) {
    // Network error or timeout
    return {
      isValid: false,
      shopDomain: domain,
      error: 'Network error',
      errorCode: 'NETWORK_ERROR',
      suggestion: 'Unable to connect. Check your internet connection and try again.',
    };
  }
}

/**
 * Get cached validation result
 * @internal
 */
async function getCachedValidation(
  domain: string
): Promise<ValidationResult | null> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('shop_validation_cache')
    .select('*')
    .eq('shop_domain', domain)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error || !data) {
    return null;
  }
  
  const row = data as ShopValidationCacheRow;
  
  return {
    isValid: row.is_valid,
    shopDomain: domain,
    error: row.validation_data?.error as string | undefined,
    errorCode: row.validation_data?.errorCode as ValidationErrorCode | undefined,
    suggestion: row.validation_data?.suggestion as string | undefined,
  };
}

/**
 * Cache validation result
 * @internal
 */
async function cacheValidation(
  domain: string,
  result: ValidationResult
): Promise<void> {
  const supabase = createAdminClient();
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);
  
  const validationData = result.isValid
    ? null
    : {
        error: result.error,
        errorCode: result.errorCode,
        suggestion: result.suggestion,
      };
  
  await supabase
    .from('shop_validation_cache')
    .upsert({
      shop_domain: domain,
      is_valid: result.isValid,
      validation_data: validationData,
      validated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
  
  // Don't throw on cache errors - validation still succeeded
}
```

### Step 3.2: Shop Validation Hook

**File**: `napoleonshopify3/src/features/shopify-oauth/hooks/useShopValidation.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { validateShopDomain } from '../services/shopValidationService';
import type { ValidationResult } from '../types';

/**
 * React Query hook for shop domain validation
 * 
 * Features:
 * - Real-time validation as user types
 * - Automatic caching (24 hours)
 * - Debouncing handled by React Query
 * 
 * @param domain - The shop domain to validate
 * @param enabled - Whether validation should run (default: domain.length > 3)
 * @returns React Query result with validation data
 * 
 * @example
 * const { data: validation, isLoading } = useShopValidation(shopDomain);
 * 
 * if (validation?.isValid) {
 *   // Show green checkmark
 * } else if (validation?.error) {
 *   // Show error message
 * }
 */
export function useShopValidation(
  domain: string,
  enabled: boolean = domain.length > 3
) {
  return useQuery<ValidationResult>({
    queryKey: ['shop-validation', domain],
    queryFn: async () => {
      // Call validation service
      const result = await validateShopDomain(domain);
      return result;
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: false, // Don't retry validation failures
  });
}
```

---

## PHASE 4: ERROR HANDLING

### Step 4.1: Error Handler

**File**: `napoleonshopify3/src/features/shopify-oauth/utils/errorHandler.ts`

```typescript
import type { OAuthError, OAuthErrorCode, UserFriendlyError } from '../types';

/**
 * Error message mapping
 */
export const ERROR_MESSAGES: Record<OAuthErrorCode, { title: string; message: string; suggestion?: string }> = {
  INVALID_SHOP_DOMAIN: {
    title: 'Invalid Store Domain',
    message: 'The store domain you entered is not valid.',
    suggestion: 'Please enter a valid Shopify domain (e.g., mystore.myshopify.com)',
  },
  SHOP_NOT_FOUND: {
    title: 'Store Not Found',
    message: 'We couldn\'t find a Shopify store with that domain.',
    suggestion: 'Please check the spelling and try again.',
  },
  USER_NOT_AUTHENTICATED: {
    title: 'Not Logged In',
    message: 'You must be logged in to connect a store.',
    suggestion: 'Please sign in and try again.',
  },
  SESSION_NOT_FOUND: {
    title: 'Session Expired',
    message: 'Your connection session has expired.',
    suggestion: 'Please start the connection process again.',
  },
  SESSION_EXPIRED: {
    title: 'Session Expired',
    message: 'Your connection session has expired.',
    suggestion: 'Please start the connection process again.',
  },
  PKCE_VERIFICATION_FAILED: {
    title: 'Security Verification Failed',
    message: 'The security verification failed.',
    suggestion: 'Please try connecting again.',
  },
  HMAC_VERIFICATION_FAILED: {
    title: 'Security Verification Failed',
    message: 'The security verification failed.',
    suggestion: 'Please try connecting again.',
  },
  TOKEN_EXCHANGE_FAILED: {
    title: 'Connection Failed',
    message: 'Failed to complete the connection with Shopify.',
    suggestion: 'Please try again. If the problem persists, contact support.',
  },
  STORE_CREATION_FAILED: {
    title: 'Failed to Save Store',
    message: 'We couldn\'t save your store connection.',
    suggestion: 'Please try again. If the problem persists, contact support.',
  },
  WEBHOOK_REGISTRATION_FAILED: {
    title: 'Webhook Registration Failed',
    message: 'Store connected but webhook registration failed.',
    suggestion: 'You can manually register webhooks in settings.',
  },
  ENCRYPTION_FAILED: {
    title: 'Encryption Failed',
    message: 'Failed to securely store your access token.',
    suggestion: 'Please try again. If the problem persists, contact support.',
  },
  ACCESS_DENIED: {
    title: 'Access Denied',
    message: 'You denied access to your Shopify store.',
    suggestion: 'To use Smart Pricing, you need to grant the requested permissions.',
  },
  NETWORK_ERROR: {
    title: 'Network Error',
    message: 'Unable to connect to the server.',
    suggestion: 'Please check your internet connection and try again.',
  },
  UNKNOWN_ERROR: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred.',
    suggestion: 'Please try again. If the problem persists, contact support.',
  },
};

/**
 * Convert OAuth error to user-friendly error
 */
export function handleOAuthError(error: Error | OAuthError): UserFriendlyError {
  const oauthError = error as OAuthError;
  const errorCode = oauthError.code || 'UNKNOWN_ERROR';
  
  const errorInfo = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN_ERROR;

  return {
    title: errorInfo.title,
    message: errorInfo.message,
    suggestion: errorInfo.suggestion,
  };
}

/**
 * Create OAuth error
 */
export function createOAuthError(
  code: OAuthErrorCode,
  message?: string,
  retryable: boolean = true
): OAuthError {
  const errorInfo = ERROR_MESSAGES[code];
  const error = new Error(message || errorInfo.message) as OAuthError;
  
  error.code = code;
  error.technicalMessage = message;
  error.suggestion = errorInfo.suggestion;
  error.retryable = retryable;
  
  return error;
}
```

### Step 4.2: Retry Logic

**File**: `napoleonshopify3/src/features/shopify-oauth/utils/retry.ts`

```typescript
/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < maxRetries - 1) {
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## PHASE 5: OAUTH API ROUTES

### Step 5.1: OAuth Initiation Route

**File**: `napoleonshopify3/src/app/api/auth/shopify/v2/initiate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/shared/lib/supabase';
import { generatePKCEPair } from '@/shared/lib/pkce';
import { createSession } from '@/features/shopify-oauth/services/sessionService';
import { validateShopDomain } from '@/features/shopify-oauth/services/shopValidationService';
import type { OAuthInitiateRequest, OAuthInitiateResponse } from '@/features/shopify-oauth/types';

/**
 * POST /api/auth/shopify/v2/initiate
 * 
 * Initiates OAuth flow with PKCE
 * 
 * Request body:
 * {
 *   "shopDomain": "mystore.myshopify.com"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "oauthUrl": "https://mystore.myshopify.com/admin/oauth/authorize?...",
 *   "sessionId": "uuid"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify user is authenticated
    const supabase = createRouteHandlerClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!user || authError) {
      return NextResponse.json<OAuthInitiateResponse>(
        {
          success: false,
          error: 'You must be logged in to connect a store',
          errorCode: 'USER_NOT_AUTHENTICATED',
        },
        { status: 401 }
      );
    }

    // Step 2: Get user profile from public.users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json<OAuthInitiateResponse>(
        {
          success: false,
          error: 'User profile not found',
          errorCode: 'USER_NOT_AUTHENTICATED',
        },
        { status: 401 }
      );
    }

    // Step 3: Parse and validate request body
    const body = await request.json() as OAuthInitiateRequest;
    
    if (!body.shopDomain) {
      return NextResponse.json<OAuthInitiateResponse>(
        {
          success: false,
          error: 'Shop domain is required',
          errorCode: 'INVALID_SHOP_DOMAIN',
        },
        { status: 400 }
      );
    }

    // Step 4: Validate shop domain
    const validation = await validateShopDomain(body.shopDomain);
    
    if (!validation.isValid) {
      return NextResponse.json<OAuthInitiateResponse>(
        {
          success: false,
          error: validation.error || 'Invalid shop domain',
          errorCode: validation.errorCode || 'INVALID_SHOP_DOMAIN',
        },
        { status: 400 }
      );
    }

    // Step 5: Generate PKCE pair
    const pkce = generatePKCEPair();

    // Step 6: Create OAuth session in database
    const session = await createSession({
      userId: userProfile.id,
      shopDomain: validation.shopDomain,
      pkce,
    });

    // Step 7: Build OAuth URL
    const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
    const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || 'read_products,write_products,read_orders';
    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL;

    if (!SHOPIFY_API_KEY || !BASE_URL) {
      return NextResponse.json<OAuthInitiateResponse>(
        {
          success: false,
          error: 'Server configuration error',
          errorCode: 'UNKNOWN_ERROR',
        },
        { status: 500 }
      );
    }

    const redirectUri = `${BASE_URL}/api/auth/shopify/v2/callback`;
    
    const oauthUrl = new URL(`https://${validation.shopDomain}/admin/oauth/authorize`);
    oauthUrl.searchParams.set('client_id', SHOPIFY_API_KEY);
    oauthUrl.searchParams.set('scope', SHOPIFY_SCOPES);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('state', session.state);
    // Note: Shopify doesn't support PKCE yet, but we use it for our own security
    // We verify the code_verifier on callback

    console.log('🔐 OAuth initiated:', {
      shopDomain: validation.shopDomain,
      sessionId: session.id,
      state: session.state,
    });

    // Step 8: Return OAuth URL
    return NextResponse.json<OAuthInitiateResponse>({
      success: true,
      oauthUrl: oauthUrl.toString(),
      sessionId: session.id,
    });

  } catch (error) {
    console.error('❌ OAuth initiation error:', error);
    
    return NextResponse.json<OAuthInitiateResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate OAuth',
        errorCode: 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}
```

### Step 4.2: OAuth Callback Route

**File**: `napoleonshopify3/src/app/api/auth/shopify/v2/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createRouteHandlerClient } from '@/shared/lib/supabase';
import { validateSession, completeSession } from '@/features/shopify-oauth/services/sessionService';
import { encryptAndStoreTokens } from '@/features/shopify-oauth/services/tokenService';
import type { OAuthCallbackParams, ShopifyTokenResponse } from '@/features/shopify-oauth/types';

/**
 * GET /api/auth/shopify/v2/callback
 * 
 * Handles OAuth callback from Shopify
 * 
 * Query params:
 * - code: Authorization code
 * - state: CSRF token
 * - shop: Shop domain
 * - hmac: HMAC signature
 * - timestamp: Request timestamp
 */
export async function GET(request: NextRequest) {
  try {
    // Step 1: Extract query parameters
    const { searchParams } = new URL(request.url);
    
    const params: OAuthCallbackParams = {
      code: searchParams.get('code') || '',
      state: searchParams.get('state') || '',
      shop: searchParams.get('shop') || '',
      hmac: searchParams.get('hmac') || '',
      timestamp: searchParams.get('timestamp') || undefined,
      host: searchParams.get('host') || undefined,
    };

    // Step 2: Check for OAuth errors from Shopify
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    if (error) {
      console.error('❌ Shopify OAuth Error:', error, errorDescription);
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'OAuth denied: ${error}${errorDescription ? ' - ' + errorDescription : ''}' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 3: Validate required parameters
    if (!params.code || !params.state || !params.shop || !params.hmac) {
      console.error('❌ Missing OAuth parameters:', params);
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Missing required OAuth parameters' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 4: Validate OAuth session
    const session = await validateSession(params.state);
    
    if (!session) {
      console.error('❌ Invalid or expired OAuth session:', params.state);
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Invalid or expired OAuth session. Please try again.' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 5: Verify HMAC signature
    const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
    
    if (!SHOPIFY_API_SECRET) {
      console.error('❌ Missing SHOPIFY_API_SECRET');
      await completeSession(session.id, false, 'Server configuration error');
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Server configuration error' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Build message for HMAC verification (exclude hmac and signature)
    const message = Array.from(searchParams.entries())
      .filter(([key]) => key !== 'hmac' && key !== 'signature')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    // Calculate expected HMAC
    const expectedHmac = crypto
      .createHmac('sha256', SHOPIFY_API_SECRET)
      .update(message)
      .digest('hex');

    // Timing-safe comparison
    const hmacValid = crypto.timingSafeEqual(
      Buffer.from(expectedHmac),
      Buffer.from(params.hmac)
    );

    if (!hmacValid) {
      console.error('❌ HMAC verification failed');
      await completeSession(session.id, false, 'HMAC verification failed');
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Security verification failed. Please try again.' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 6: Exchange authorization code for access token
    const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
    const shopDomain = params.shop.includes('.myshopify.com') 
      ? params.shop 
      : `${params.shop}.myshopify.com`;

    const tokenResponse = await fetch(
      `https://${shopDomain}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: SHOPIFY_API_KEY,
          client_secret: SHOPIFY_API_SECRET,
          code: params.code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed:', tokenResponse.status);
      await completeSession(session.id, false, 'Token exchange failed');
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Failed to exchange authorization code for access token' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const tokenData = await tokenResponse.json() as ShopifyTokenResponse;

    if (!tokenData.access_token) {
      console.error('❌ No access token in response');
      await completeSession(session.id, false, 'No access token received');
      return new NextResponse(
        `<html><body><script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'No access token received from Shopify' 
            }, window.location.origin);
          }
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Step 7: Encrypt and store tokens
    const storeId = await encryptAndStoreTokens(
      session.userId,
      shopDomain,
      {
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
      }
    );

    // Step 8: Register webhooks (non-blocking)
    registerWebhooksAsync(storeId, shopDomain, tokenData.access_token).catch(err => {
      console.error('Webhook registration failed (non-critical):', err);
    });

    // Step 9: Trigger product sync (non-blocking)
    triggerProductSyncAsync(storeId, shopDomain, tokenData.access_token).catch(err => {
      console.error('Product sync failed (non-critical):', err);
    });

    // Step 10: Mark session as completed
    await completeSession(session.id, true);

    console.log('✅ OAuth completed successfully:', {
      shopDomain,
      storeId,
      sessionId: session.id,
    });

    // Step 11: Close window and notify parent
    return new NextResponse(
      `<html><body><script>
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'OAUTH_SUCCESS',
            storeId: '${storeId}',
            shopDomain: '${shopDomain}'
          }, window.location.origin);
        }
        window.close();
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    
    return new NextResponse(
      `<html><body><script>
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'OAUTH_ERROR', 
            error: 'OAuth callback failed: ${error instanceof Error ? error.message : 'Unknown error'}' 
          }, window.location.origin);
        }
        window.close();
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Register webhooks asynchronously (non-blocking)
 */
async function registerWebhooksAsync(
  storeId: string,
  shopDomain: string,
  accessToken: string
): Promise<void> {
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/product-update`;
  const baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;
  
  // Check for existing webhooks
  const existingResponse = await fetch(`${baseUrl}/webhooks.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });
  
  if (!existingResponse.ok) {
    throw new Error(`Failed to fetch existing webhooks: ${existingResponse.status}`);
  }
  
  const { webhooks } = await existingResponse.json();
  
  // Check if webhook already exists
  const existingWebhook = webhooks?.find((w: any) => 
    w.topic === 'products/update' && w.address === webhookUrl
  );
  
  if (existingWebhook) {
    console.log('Webhook already registered:', existingWebhook.id);
    return;
  }
  
  // Register new webhook
  const registerResponse = await fetch(`${baseUrl}/webhooks.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      webhook: {
        topic: 'products/update',
        address: webhookUrl,
        format: 'json',
      },
    }),
  });
  
  if (!registerResponse.ok) {
    const error = await registerResponse.json();
    throw new Error(`Failed to register webhook: ${JSON.stringify(error)}`);
  }
  
  const { webhook } = await registerResponse.json();
  console.log('Webhook registered successfully:', webhook.id);
}

/**
 * Trigger product sync asynchronously (non-blocking)
 */
async function triggerProductSyncAsync(
  storeId: string,
  shopDomain: string,
  accessToken: string
): Promise<void> {
  // Import sync service
  const { syncProductsFromShopify } = await import(
    '@/features/shopify-integration/services/syncProducts'
  );
  
  // Trigger sync (don't await)
  syncProductsFromShopify(storeId, shopDomain, accessToken).catch(err => {
    console.error('Product sync error:', err);
  });
}
```

---

## PHASE 6: UI COMPONENTS

### Step 6.1: Store Connection Modal

**File**: `napoleonshopify3/src/features/shopify-oauth/components/StoreConnectionModal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { ShopDomainInput } from './ShopDomainInput';
import { PermissionPreview } from './PermissionPreview';
import { OAuthProgress } from './OAuthProgress';
import { ConnectionSuccess } from './ConnectionSuccess';
import { Button } from '@/shared/components/ui/button';
import { useOAuthFlow } from '../hooks/useOAuthFlow';
import type { StoreConnectionModalProps, ValidationResult } from '../types';

/**
 * Store Connection Modal
 * 
 * Multi-step modal for connecting Shopify stores:
 * 1. Enter shop domain
 * 2. Validate domain
 * 3. Show permissions
 * 4. Connect (redirect to Shopify)
 * 5. Show progress
 * 6. Show success
 */
export function StoreConnectionModal({
  open,
  onClose,
  onSuccess,
}: StoreConnectionModalProps) {
  const [step, setStep] = useState<'input' | 'permissions' | 'connecting' | 'success'>('input');
  const [shopDomain, setShopDomain] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [connectedStore, setConnectedStore] = useState<{
    id: string;
    shopDomain: string;
    installedAt: Date;
  } | null>(null);

  const { initiateOAuth, isInitiating } = useOAuthFlow();

  const handleValidation = (result: ValidationResult) => {
    setValidation(result);
  };

  const handleContinue = () => {
    if (validation?.isValid) {
      setStep('permissions');
    }
  };

  const handleConnect = async () => {
    if (!validation?.isValid) return;

    setStep('connecting');
    
    try {
      const result = await initiateOAuth(validation.shopDomain);
      
      if (result.success) {
        // OAuth will redirect, so we show progress
        // Success will be handled by message listener
      } else {
        // Show error and go back to input
        setStep('input');
      }
    } catch (error) {
      console.error('OAuth initiation failed:', error);
      setStep('input');
    }
  };

  const handleClose = () => {
    setStep('input');
    setShopDomain('');
    setValidation(null);
    setConnectedStore(null);
    onClose();
  };

  const handleSuccessContinue = () => {
    if (connectedStore && onSuccess) {
      onSuccess(connectedStore.id);
    }
    handleClose();
  };

  // Listen for OAuth success message
  useState(() => {
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'OAUTH_SUCCESS') {
        setConnectedStore({
          id: event.data.storeId,
          shopDomain: event.data.shopDomain,
          installedAt: new Date(),
        });
        setStep('success');
      } else if (event.data.type === 'OAUTH_ERROR') {
        setStep('input');
      }
    };
    
    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'input' && 'Connect Your Shopify Store'}
            {step === 'permissions' && 'Review Permissions'}
            {step === 'connecting' && 'Connecting...'}
            {step === 'success' && 'Store Connected!'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {step === 'input' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your Shopify store domain to connect it to Smart Pricing.
              </p>
              
              <ShopDomainInput
                value={shopDomain}
                onChange={setShopDomain}
                onValidation={handleValidation}
                autoFocus
              />

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleContinue}
                  disabled={!validation?.isValid}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 'permissions' && validation && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Smart Pricing will request the following permissions:
              </p>
              
              <PermissionPreview
                shopDomain={validation.shopDomain}
                scopes={['read_products', 'write_products', 'read_orders']}
              />

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setStep('input')}>
                  Back
                </Button>
                <Button onClick={handleConnect} disabled={isInitiating}>
                  {isInitiating ? 'Connecting...' : 'Connect Store'}
                </Button>
              </div>
            </div>
          )}

          {step === 'connecting' && (
            <OAuthProgress
              step={2}
              totalSteps={5}
              status="authorizing"
              message="Waiting for authorization on Shopify..."
            />
          )}

          {step === 'success' && connectedStore && (
            <ConnectionSuccess
              store={connectedStore}
              onContinue={handleSuccessContinue}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 6.2: Shop Domain Input

**File**: `napoleonshopify3/src/features/shopify-oauth/components/ShopDomainInput.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useShopValidation } from '../hooks/useShopValidation';
import type { ShopDomainInputProps } from '../types';

/**
 * Shop Domain Input Component
 * 
 * Features:
 * - Real-time validation with debouncing
 * - Visual feedback (checkmark/error)
 * - Auto-format (.myshopify.com)
 * - Helpful error messages
 */
export function ShopDomainInput({
  value,
  onChange,
  onValidation,
  disabled,
  autoFocus,
}: ShopDomainInputProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  // Debounce input (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, 500);

    return () => clearTimeout(timer);
  }, [value]);

  // Validate debounced value
  const { data: validation, isLoading } = useShopValidation(
    debouncedValue,
    debouncedValue.length > 3
  );

  // Notify parent of validation result
  useEffect(() => {
    if (validation && onValidation) {
      onValidation(validation);
    }
  }, [validation, onValidation]);

  const showValidation = debouncedValue.length > 3 && !isLoading;
  const isValid = validation?.isValid;
  const hasError = showValidation && !isValid;

  return (
    <div className="space-y-2">
      <Label htmlFor="shop-domain">Shopify Store Domain</Label>
      
      <div className="relative">
        <Input
          id="shop-domain"
          type="text"
          placeholder="mystore.myshopify.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`pr-10 ${
            isValid ? 'border-green-500 focus-visible:ring-green-500' :
            hasError ? 'border-red-500 focus-visible:ring-red-500' :
            ''
          }`}
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {showValidation && isValid && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          {hasError && (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>
      </div>

      {hasError && validation?.error && (
        <div className="space-y-1">
          <p className="text-sm text-red-500">{validation.error}</p>
          {validation.suggestion && (
            <p className="text-xs text-muted-foreground">{validation.suggestion}</p>
          )}
        </div>
      )}

      {showValidation && isValid && (
        <p className="text-sm text-green-600">✓ Store found and ready to connect</p>
      )}
    </div>
  );
}
```

### Step 6.3: Permission Preview

**File**: `napoleonshopify3/src/features/shopify-oauth/components/PermissionPreview.tsx`

```typescript
'use client';

import { Card, CardContent } from '@/shared/components/ui/card';
import { Package, Edit, ShoppingCart } from 'lucide-react';
import type { PermissionPreviewProps } from '../types';

/**
 * Permission Preview Component
 * 
 * Shows what permissions the app will request
 */
export function PermissionPreview({ shopDomain, scopes }: PermissionPreviewProps) {
  const permissions = [
    {
      scope: 'read_products',
      icon: <Package className="h-5 w-5 text-blue-500" />,
      title: 'Read Products',
      description: 'View your product catalog, pricing, and inventory levels',
    },
    {
      scope: 'write_products',
      icon: <Edit className="h-5 w-5 text-green-500" />,
      title: 'Update Products',
      description: 'Automatically adjust product prices based on your pricing rules',
    },
    {
      scope: 'read_orders',
      icon: <ShoppingCart className="h-5 w-5 text-purple-500" />,
      title: 'Read Orders',
      description: 'Analyze sales data to optimize pricing strategies',
    },
  ];

  const requestedPermissions = permissions.filter(p => 
    scopes.includes(p.scope)
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Permissions for {shopDomain}</h4>
            <span className="text-xs text-muted-foreground">
              {requestedPermissions.length} permissions
            </span>
          </div>

          <div className="space-y-3">
            {requestedPermissions.map((permission, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="mt-0.5">{permission.icon}</div>
                <div className="flex-1">
                  <h5 className="text-sm font-medium">{permission.title}</h5>
                  <p className="text-xs text-muted-foreground">
                    {permission.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              You can revoke these permissions at any time from your Shopify admin panel.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 6.4: OAuth Progress

**File**: `napoleonshopify3/src/features/shopify-oauth/components/OAuthProgress.tsx`

```typescript
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
```

### Step 6.5: Connection Success

**File**: `napoleonshopify3/src/features/shopify-oauth/components/ConnectionSuccess.tsx`

```typescript
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
          We're now importing your products in the background. This may take a few minutes.
        </p>
        <Button onClick={onContinue} className="w-full">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
```

---

## PHASE 7: REACT QUERY HOOKS

### Step 7.1: OAuth Flow Hook

**File**: `napoleonshopify3/src/features/shopify-oauth/hooks/useOAuthFlow.ts`

```typescript
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { OAuthInitiateRequest, OAuthInitiateResponse } from '../types';

/**
 * OAuth Flow Hook
 * 
 * Handles OAuth initiation and redirect
 */
export function useOAuthFlow() {
  const [isInitiating, setIsInitiating] = useState(false);

  const initiateMutation = useMutation({
    mutationFn: async (shopDomain: string) => {
      const response = await fetch('/api/auth/shopify/v2/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopDomain } as OAuthInitiateRequest),
      });

      const data = await response.json() as OAuthInitiateResponse;

      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate OAuth');
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.oauthUrl) {
        // Redirect to Shopify OAuth
        window.location.href = data.oauthUrl;
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to connect store');
      setIsInitiating(false);
    },
  });

  const initiateOAuth = async (shopDomain: string) => {
    setIsInitiating(true);
    return initiateMutation.mutateAsync(shopDomain);
  };

  return {
    initiateOAuth,
    isInitiating: isInitiating || initiateMutation.isPending,
  };
}
```

### Step 7.2: OAuth Session Hook

**File**: `napoleonshopify3/src/features/shopify-oauth/hooks/useOAuthSession.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import type { OAuthSession } from '../types';

/**
 * OAuth Session Hook
 * 
 * Tracks OAuth session status (for polling)
 */
export function useOAuthSession(sessionId?: string) {
  return useQuery<OAuthSession | null>({
    queryKey: ['oauth-session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;

      const response = await fetch(`/api/auth/shopify/v2/session/${sessionId}`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.session || null;
    },
    enabled: !!sessionId,
    refetchInterval: 2000, // Poll every 2 seconds
    staleTime: 0, // Always fetch fresh data
  });
}
```

---

## PHASE 8: INTEGRATION

### Step 8.1: Create Feature Index

**File**: `napoleonshopify3/src/features/shopify-oauth/index.ts`

```typescript
// Components
export { StoreConnectionModal } from './components/StoreConnectionModal';
export { ShopDomainInput } from './components/ShopDomainInput';
export { PermissionPreview } from './components/PermissionPreview';
export { OAuthProgress } from './components/OAuthProgress';
export { ConnectionSuccess } from './components/ConnectionSuccess';

// Hooks
export { useOAuthFlow } from './hooks/useOAuthFlow';
export { useOAuthSession } from './hooks/useOAuthSession';
export { useShopValidation } from './hooks/useShopValidation';

// Services
export * from './services/sessionService';
export * from './services/tokenService';
export * from './services/shopValidationService';

// Types
export type * from './types';

// Utils
export * from './utils/errorHandler';
export * from './utils/retry';
```

### Step 8.2: Update Settings Page

**File**: `napoleonshopify3/src/app/(app)/settings/page.tsx`

Find and replace the old OAuth implementation:

```typescript
// OLD CODE (remove these lines):
import { useShopifyOAuth } from '@/features/auth/hooks/useShopifyOAuth';
const { initiateOAuth, isConnecting } = useShopifyOAuth();

// NEW CODE (add these lines):
import { StoreConnectionModal } from '@/features/shopify-oauth';
const [showConnectionModal, setShowConnectionModal] = useState(false);

// OLD CODE (remove this button):
<Button onClick={() => initiateOAuth()} disabled={isConnecting}>
  {isConnecting ? 'Connecting...' : 'Connect Store'}
</Button>

// NEW CODE (replace with this):
<Button onClick={() => setShowConnectionModal(true)}>
  Connect Store
</Button>

<StoreConnectionModal 
  open={showConnectionModal}
  onClose={() => setShowConnectionModal(false)}
  onSuccess={(storeId) => {
    console.log('Store connected:', storeId);
    // Optionally redirect or show success message
  }}
/>
```

---

## PHASE 9: CLEANUP

### Step 9.1: Files to Delete

Delete these old OAuth files:

```bash
# Old OAuth hook (replaced by new modal)
rm napoleonshopify3/src/features/auth/hooks/useShopifyOAuth.ts

# Old OAuth routes (replaced by v2)
rm napoleonshopify3/src/app/api/auth/shopify/route.ts
rm napoleonshopify3/src/app/api/auth/shopify/callback/route.ts

# Test pages (no longer needed)
rm -rf napoleonshopify3/src/app/test-oauth
rm -rf napoleonshopify3/src/app/test-oauth-debug
rm -rf napoleonshopify3/src/app/test-oauth-real
```

### Step 9.2: Update Auth Feature Exports

**File**: `napoleonshopify3/src/features/auth/index.ts`

Remove the old export:

```typescript
// REMOVE THIS LINE:
export { useShopifyOAuth } from './hooks/useShopifyOAuth';

// Keep other exports as is
```

---

## PHASE 10: TESTING

### Step 10.1: Manual Testing Checklist

```markdown
## OAuth Flow Testing

### Prerequisites
- [ ] Database migration 012 has been run
- [ ] Environment variables are set correctly
- [ ] Shopify Partner Dashboard URLs are configured
- [ ] User is logged in to the app

### Test Cases

#### 1. Shop Domain Validation
- [ ] Enter invalid domain (e.g., "test") → Shows error
- [ ] Enter valid domain (e.g., "mystore.myshopify.com") → Shows checkmark
- [ ] Enter domain without .myshopify.com → Auto-formats correctly
- [ ] Enter non-existent domain → Shows "Store not found" error

#### 2. OAuth Initiation
- [ ] Click "Connect Store" → Modal opens
- [ ] Enter valid shop domain → Can proceed to permissions
- [ ] Click "Continue" → Shows permission preview
- [ ] Click "Connect Store" → Redirects to Shopify

#### 3. OAuth Authorization
- [ ] Shopify authorization page loads correctly
- [ ] Can see requested permissions
- [ ] Click "Install app" → Redirects back to app
- [ ] OAuth callback completes successfully

#### 4. Post-Connection
- [ ] Store appears in stores list
- [ ] Access token is encrypted in database
- [ ] Webhooks are registered
- [ ] Product sync starts automatically
- [ ] Success message is shown

#### 5. Error Handling
- [ ] Cancel OAuth on Shopify → Shows error message
- [ ] Network error → Shows appropriate error
- [ ] Session expires → Shows session expired error
- [ ] HMAC verification fails → Shows security error

#### 6. Edge Cases
- [ ] Connect same store twice → Updates existing store
- [ ] Multiple stores → All appear in list
- [ ] Disconnect store → Store becomes inactive
- [ ] Reconnect store → Reactivates store
```

### Step 10.2: Database Verification Queries

```sql
-- Check OAuth sessions
SELECT 
  id, 
  shop_domain, 
  status, 
  created_at, 
  expires_at 
FROM oauth_sessions 
ORDER BY created_at DESC 
LIMIT 10;

-- Check stores
SELECT 
  id, 
  shop_domain, 
  scope, 
  is_active, 
  installed_at 
FROM stores 
ORDER BY installed_at DESC;

-- Check webhook registrations
SELECT 
  wr.id, 
  s.shop_domain, 
  wr.topic, 
  wr.is_active, 
  wr.registered_at
FROM webhook_registrations wr
JOIN stores s ON wr.store_id = s.id
ORDER BY wr.registered_at DESC;

-- Check sync status
SELECT 
  ss.id, 
  s.shop_domain, 
  ss.status, 
  ss.products_synced, 
  ss.total_products, 
  ss.started_at
FROM sync_status ss
JOIN stores s ON ss.store_id = s.id
ORDER BY ss.started_at DESC;

-- Check for OAuth errors
SELECT 
  error_type, 
  COUNT(*) as count 
FROM oauth_error_log 
GROUP BY error_type 
ORDER BY count DESC;
```

---

## IMPLEMENTATION CHECKLIST

Use this checklist to track implementation progress:

### Phase 1: Database ✓
- [ ] Create migration file `012_oauth_enhancements.sql`
- [ ] Run migration in Supabase
- [ ] Verify tables exist
- [ ] Verify RLS policies are enabled
- [ ] Verify functions exist

### Phase 2: Core Security ✓
- [ ] Create `src/shared/lib/pkce.ts`
- [ ] Create `src/features/shopify-oauth/types/index.ts`
- [ ] Create `src/features/shopify-oauth/services/sessionService.ts`
- [ ] Create `src/features/shopify-oauth/services/tokenService.ts`
- [ ] Test PKCE generation and verification

### Phase 3: Shop Validation ✓
- [ ] Create `src/features/shopify-oauth/services/shopValidationService.ts`
- [ ] Create `src/features/shopify-oauth/hooks/useShopValidation.ts`
- [ ] Test shop domain validation
- [ ] Test validation caching

### Phase 4: Error Handling ✓
- [ ] Create `errorHandler.ts`
- [ ] Create `retry.ts`
- [ ] Test error scenarios
- [ ] Verify user-friendly error messages

### Phase 5: OAuth API Routes ✓
- [ ] Create `src/app/api/auth/shopify/v2/initiate/route.ts`
- [ ] Create `src/app/api/auth/shopify/v2/callback/route.ts`
- [ ] Test OAuth initiation
- [ ] Test OAuth callback
- [ ] Test HMAC verification
- [ ] Test token exchange

### Phase 6: UI Components ✓
- [ ] Create `StoreConnectionModal.tsx`
- [ ] Create `ShopDomainInput.tsx`
- [ ] Create `PermissionPreview.tsx`
- [ ] Create `OAuthProgress.tsx`
- [ ] Create `ConnectionSuccess.tsx`
- [ ] Test all components in isolation

### Phase 7: React Query Hooks ✓
- [ ] Create `useOAuthFlow.ts`
- [ ] Create `useOAuthSession.ts`
- [ ] Test hooks with React Query DevTools

### Phase 8: Integration ✓
- [ ] Create feature index.ts
- [ ] Update Settings page
- [ ] Update StoreConnectionCard (if needed)
- [ ] Test full integration

### Phase 9: Cleanup ✓
- [ ] Delete old OAuth files
- [ ] Update auth feature exports
- [ ] Remove test pages
- [ ] Clean up imports

### Phase 10: Testing ✓
- [ ] Complete manual testing checklist
- [ ] Run database verification queries
- [ ] Test with real Shopify store
- [ ] Verify webhooks are registered
- [ ] Verify products sync correctly

### Final Steps ✓
- [ ] Update environment variables
- [ ] Configure Shopify Partner Dashboard
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Document any issues

---

## TROUBLESHOOTING

### Common Issues

**Issue**: "Missing SHOPIFY_API_KEY environment variable"
**Solution**: Add `SHOPIFY_API_KEY` to `.env.local`

**Issue**: "HMAC verification failed"
**Solution**: Check that `SHOPIFY_API_SECRET` is correct and matches Shopify Partner Dashboard

**Issue**: "Invalid redirect URI"
**Solution**: Ensure `NEXT_PUBLIC_APP_URL/api/auth/shopify/v2/callback` is added to Shopify Partner Dashboard allowed redirect URLs

**Issue**: "Session expired"
**Solution**: OAuth sessions expire after 10 minutes. Start the flow again.

**Issue**: "Store not found"
**Solution**: Verify the shop domain is correct and the store exists

**Issue**: "Encryption failed"
**Solution**: Ensure `ENCRYPTION_KEY` is exactly 32 characters

**Issue**: "User profile not found"
**Solution**: Ensure user has a profile in `public.users` table linked to `auth.users`

---

## SUCCESS CRITERIA

The implementation is complete when:

1. ✅ All database tables are created and RLS is enabled
2. ✅ PKCE is working correctly
3. ✅ Shop domain validation works with caching
4. ✅ OAuth initiation redirects to Shopify
5. ✅ OAuth callback completes successfully
6. ✅ Tokens are encrypted and stored
7. ✅ Webhooks are registered automatically
8. ✅ Products sync in background
9. ✅ UI components render correctly
10. ✅ Error handling works for all scenarios
11. ✅ Old OAuth code is removed
12. ✅ Manual testing passes all test cases

---

## NEXT STEPS

After implementation:

1. **Monitor**: Watch for OAuth errors in `oauth_error_log` table
2. **Optimize**: Add cron jobs for cleanup functions
3. **Enhance**: Add retry logic for failed webhooks
4. **Scale**: Add rate limiting for OAuth endpoints
5. **Document**: Update user documentation with connection instructions

---

**END OF SPECIFICATION**

This specification is now complete and contains everything needed to implement the OAuth system with zero ambiguity.

