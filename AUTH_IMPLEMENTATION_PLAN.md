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

See full migration SQL in the plan document.

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

**Authentication > Password:**
- Minimum password length: 10
- Require uppercase: ON
- Require lowercase: ON  
- Require numbers: ON
- Require special characters: ON

**Authentication > MFA:**
- Enable TOTP: ON
- Max enrolled factors: 10

**SMTP Settings:**
- Configure SendGrid/Postmark
- Test email delivery

---

## STAGE 2: Build New System (Parallel, Non-Breaking)

### Step 6: Rename Old Supabase Client
```bash
mv src/shared/lib/supabase.ts src/shared/lib/supabase.old.ts
```

### Step 7-15: Create New Auth System
- New Supabase SSR client
- API auth helpers (requireAuth, requireStore)
- Auth hooks (useAuth, useAuthMutations, useStores, useShopifyOAuth)
- Auth components (AuthModal, MFAModal)
- API client for x-store-id header

---

## STAGE 3: Security API Routes & Middleware

### Steps 16-22: Security Infrastructure
- check-login-attempts route
- track-failed-login route
- log-event route
- Rewrite Shopify OAuth callback with encryption
- Create middleware with security headers
- Create security settings page

---

## STAGE 4: Gradual API Route Migration

### Step 23: Test with ONE API Route
Feature flag approach:
```typescript
if (process.env.USE_NEW_AUTH !== 'true') {
  // Use old auth
  return
}
// Use new auth
const { user, store, error } = await requireStore(request)
if (error) return error
```

### Steps 24-27: Migrate All Routes
- Products routes
- Pricing routes
- Analytics routes  
- Settings routes
- Shopify routes

---

## STAGE 5: Frontend Switchover

### Step 28: Enable Feature Flag
```
USE_NEW_AUTH=true
```

### Step 29: Update Landing Page

### Step 30: Cleanup After 1 Week
- Delete old auth files
- Remove feature flags
- Remove supabase.old.ts

---

## Key Files to Create

**Delete:**
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/session/route.ts`
- `src/features/auth/hooks/useAuth.ts` (old)
- `src/features/auth/components/LoginForm.tsx`
- `src/features/auth/services/` (folder)

**Create:**
- `supabase/migrations/008_supabase_auth_integration.sql`
- `src/shared/lib/supabase.ts` (rewrite)
- `src/shared/lib/apiAuth.ts`
- `src/shared/lib/apiClient.ts`
- `src/features/auth/hooks/useAuth.ts` (new)
- `src/features/auth/hooks/useAuthMutations.ts`
- `src/features/auth/hooks/useStores.ts`
- `src/features/auth/hooks/useShopifyOAuth.ts`
- `src/features/auth/components/AuthModal.tsx`
- `src/features/auth/components/MFAModal.tsx`
- `src/app/page.tsx` (rewrite)
- `src/app/auth/update-password/page.tsx`
- `src/app/api/auth/check-login-attempts/route.ts`
- `src/app/api/auth/track-failed-login/route.ts`
- `src/app/api/auth/log-event/route.ts`
- `src/middleware.ts`
- `src/app/(app)/settings/security/page.tsx`

---

## Testing Checklist

- [ ] Signup creates Supabase user + profile
- [ ] Login succeeds with correct credentials
- [ ] Login fails after 5 attempts (15min lockout)
- [ ] Magic link sends email and works
- [ ] Password reset sends email and works
- [ ] MFA setup shows QR + backup codes
- [ ] MFA challenge blocks login without code
- [ ] Shopify OAuth opens popup, requires login first
- [ ] Shopify OAuth encrypts token, stores correctly
- [ ] Store switching invalidates product queries
- [ ] Logout clears all queries
- [ ] Protected routes redirect to landing
- [ ] API routes return 401 without auth
- [ ] RLS policies block cross-user access
- [ ] Audit log records all events
- [ ] HMAC verification required in callback

---

## Security Features

1. **Token Encryption**: Shopify tokens encrypted with pgcrypto
2. **Failed Login Tracking**: Lock account after 5 failed attempts
3. **Audit Logging**: All security events logged
4. **Rate Limiting**: Prevent brute force attacks
5. **MFA/2FA**: TOTP authenticator support
6. **RLS Policies**: Database-level access control
7. **Session Auto-Refresh**: Prevent mid-session logout
8. **HMAC Verification**: Required for Shopify OAuth

---

## Architecture Principles

1. **React Query for everything** - No useState/useEffect for data
2. **No service layer** - Supabase SDK is comprehensive
3. **No Zustand** - React Query + Context sufficient
4. **Single-page auth** - All flows in modals
5. **OAuth in popup** - No navigation disruption
6. **Security first** - Encryption, audit logs, rate limits
7. **Minimal code** - Delete > Create
8. **Staged rollout** - Feature flags for safety

---

For complete implementation details including all code examples, see the full plan in Cursor's plan viewer.

