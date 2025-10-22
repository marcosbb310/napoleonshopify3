# Troubleshooting Internal Server Error

## Quick Diagnostic Steps

### 1. Check Browser Console (F12)
Look for specific error messages that will tell us exactly what's failing.

### 2. Check Which Page Is Failing
- `/` (Landing page)
- `/dashboard`
- `/products`
- Other?

### 3. Common Causes After Auth Migration

#### A. No Store Linked to User
**Symptom**: API returns 400 "x-store-id header required" or 404 "Store not found"

**Check**:
```sql
-- In Supabase SQL Editor
SELECT u.id as user_id, u.email, s.id as store_id, s.shop_domain, s.access_token IS NOT NULL as has_token
FROM users u
LEFT JOIN stores s ON s.user_id = u.id
WHERE u.auth_user_id IS NOT NULL;
```

**Fix**: Run migration 010 if store is missing:
```bash
cd napoleonshopify3
npx supabase db push
```

#### B. Missing Auth User
**Symptom**: Middleware redirects or "Unauthorized" errors

**Check**: Create a test user in Supabase Dashboard:
1. Go to Authentication → Users
2. Click "Add User"
3. Email: test@example.com
4. Password: (strong password)
5. Confirm email automatically

#### C. RLS Policies Blocking Access
**Symptom**: Queries return empty even though data exists

**Check**:
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'stores', 'pricing_config');
```

**Temporary Fix** (development only):
```sql
-- Disable RLS temporarily to test
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;
```

#### D. Token Decryption Failing
**Symptom**: "Failed to decrypt store token" in API logs

**Check**: Verify ENCRYPTION_KEY is set in `.env.local`

**Fix**: If using plain text tokens (migration 010 default), they should work with the fallback logic.

### 4. Check Server Logs

Start dev server and watch for errors:
```bash
cd napoleonshopify3
npm run dev
```

Look for:
- Database connection errors
- Missing environment variables
- TypeScript compilation errors
- Module import errors

### 5. Verify Migrations Ran

```bash
cd napoleonshopify3
npx supabase db diff
```

Should show no pending changes if all migrations applied.

### 6. Test API Directly

Open browser and go to:
- `http://localhost:3000/api/shopify/products` (should return 400 or 401 without auth)
- Check Network tab in DevTools for actual response

## Most Likely Issues

### Issue 1: No Store Created
**Solution**: 
1. Make sure migration 010 ran
2. Verify user has `auth_user_id` set
3. Check stores table has a row with that `user_id`

### Issue 2: RLS Blocking Queries
**Solution**: Check RLS policies allow access for authenticated user

### Issue 3: Supabase Client Not Initialized
**Solution**: Verify `.env.local` has all Supabase variables:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ENCRYPTION_KEY=...
```

## Debug Mode

Add this to `src/shared/lib/apiAuth.ts` at the start of `requireStore`:

```typescript
export async function requireStore(request: NextRequest) {
  console.log('🔍 requireStore called');
  console.log('Headers:', Object.fromEntries(request.headers.entries()));
  
  const { user, error } = await requireAuth(request)
  console.log('👤 User:', user?.id);
  if (error) {
    console.error('❌ Auth error:', error);
    return { user: null, store: null, error }
  }
  
  const storeId = request.headers.get('x-store-id')
  console.log('🏪 Store ID from header:', storeId);
  
  // ... rest of function
}
```

This will show you exactly where the request is failing.

## Need More Help?

Provide these details:
1. **Exact URL** that's failing (e.g., `http://localhost:3000/products`)
2. **Browser console output** (F12 → Console tab, copy all red errors)
3. **Server terminal output** (copy error from `npm run dev` console)
4. **Which step** you're at (signed in? on landing page? etc.)

