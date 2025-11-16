# Multi-User Store Support - Implementation Analysis

## Current Architecture

### How Stores Are Currently Accessed

**Pattern 1: Direct user_id check**
```typescript
// Current: src/features/shopify-integration/hooks/useStores.ts (line 66)
.eq('user_id', user.id)  // Only shows stores where user_id matches
```

**Pattern 2: requireStore() helper**
```typescript
// Current: src/shared/lib/apiAuth.ts (line 80)
.eq('user_id', userProfile.id)  // Only allows access if user_id matches
```

**Pattern 3: API routes**
```typescript
// Current: src/app/api/stores/route.ts (line 32)
.eq('user_id', userProfile.id)  // Only returns stores for this user
```

## What Needs to Change

### 1. Database Changes (Easy - Backward Compatible)

**New Table: `store_users`**
```sql
CREATE TABLE store_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, user_id)
);
```

**Update `stores` table**
```sql
-- Add owner_id (backward compatible - can be NULL initially)
ALTER TABLE stores ADD COLUMN owner_id UUID REFERENCES users(id);
```

**Migration for existing stores**
```sql
-- Convert existing stores to multi-user format
INSERT INTO store_users (store_id, user_id, role, is_active)
SELECT id, user_id, 'owner', true
FROM stores
ON CONFLICT DO NOTHING;

-- Set owner_id
UPDATE stores SET owner_id = user_id WHERE owner_id IS NULL;
```

**Complexity**: ⭐ Easy - Backward compatible, no breaking changes

---

### 2. Core Functions to Update

#### A. `requireStore()` - src/shared/lib/apiAuth.ts

**Current (line 80):**
```typescript
.eq('user_id', userProfile.id)  // Only checks user_id
```

**New:**
```typescript
// Check if user has access via store_users table
const { data: storeAccess } = await supabaseAdmin
  .from('store_users')
  .select('role, is_active, store:stores(*)')
  .eq('store_id', storeId)
  .eq('user_id', userProfile.id)
  .eq('is_active', true)
  .single();

if (!storeAccess || !storeAccess.store) {
  return { user, store: null, error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
}

return { user, store: storeAccess.store, access: storeAccess, error: null };
```

**Complexity**: ⭐⭐ Medium - Need to change query, add role checking

---

#### B. `useStores()` - src/features/shopify-integration/hooks/useStores.ts

**Current (line 66):**
```typescript
.eq('user_id', user.id)  // Direct user_id filter
```

**New:**
```typescript
// Get stores via store_users join
const { data, error } = await supabase
  .from('store_users')
  .select(`
    role,
    is_active,
    store:stores(
      id,
      shop_domain,
      scope,
      installed_at,
      last_synced_at,
      is_active,
      created_at,
      updated_at,
      owner_id
    )
  `)
  .eq('user_id', userProfile.id)
  .eq('is_active', true)
  .eq('store.is_active', true);

// Transform to include role
const storesWithRole = data?.map(item => ({
  ...item.store,
  userRole: item.role,  // Add role to store object
})) || [];
```

**Complexity**: ⭐⭐ Medium - Need to change query structure, add role

---

#### C. `encryptAndStoreTokens()` - src/features/shopify-oauth/services/tokenService.ts

**Current (line 64-69):**
```typescript
// Check if store exists for this user
.eq('shop_domain', shopDomain)
.eq('user_id', userId)
```

**New:**
```typescript
// Step 1: Check if store exists (any user)
const { data: existingStore } = await supabase
  .from('stores')
  .select('id, owner_id')
  .eq('shop_domain', shopDomain)
  .single();

if (existingStore) {
  // Check if user has access
  const { data: access } = await supabase
    .from('store_users')
    .select('role')
    .eq('store_id', existingStore.id)
    .eq('user_id', userId)
    .single();
  
  if (access) {
    // User has access - update tokens
    // ... update store tokens
  } else {
    // User doesn't have access - add them as owner (first connection)
    // OR throw error if store already has owner
    if (existingStore.owner_id) {
      throw new Error('Store already connected to another account');
    }
    // Add user as owner
    await supabase.from('store_users').insert({
      store_id: existingStore.id,
      user_id: userId,
      role: 'owner',
    });
  }
} else {
  // Create new store and add user as owner
  // ... create store
  // ... add to store_users as owner
}
```

**Complexity**: ⭐⭐⭐ Medium-Hard - Logic is more complex, need to handle multiple cases

---

### 3. Files That Need Updates

#### High Priority (Core Functionality)
1. ✅ `src/shared/lib/apiAuth.ts` - `requireStore()` function
2. ✅ `src/features/shopify-integration/hooks/useStores.ts` - Store fetching
3. ✅ `src/features/shopify-oauth/services/tokenService.ts` - OAuth connection
4. ✅ `src/app/api/stores/route.ts` - Store API endpoint

#### Medium Priority (UI & Features)
5. `src/features/auth/hooks/useCurrentStore.ts` - Store selection
6. `src/app/(app)/settings/page.tsx` - Store settings UI
7. `src/features/shopify-integration/components/StoreConnectionCard.tsx` - Store card UI

#### Low Priority (Nice to Have)
8. `src/features/product-management/` - Add role checks to actions
9. `src/features/pricing-engine/` - Add role checks to pricing actions

**Total Files to Change**: ~10-15 files

---

## How It Fits Into Current Structure

### ✅ Good Fit - Current Architecture Supports It

**1. Feature-Based Structure**
- Current: `src/features/shopify-integration/`
- Multi-user: Fits perfectly - just add `store_users` service/hooks
- New files: `src/features/shopify-integration/services/storeUsersService.ts`
- New hooks: `src/features/shopify-integration/hooks/useStoreAccess.ts`

**2. Shared Helpers**
- Current: `src/shared/lib/apiAuth.ts` has `requireStore()`
- Multi-user: Update same function, add role parameter
- Minimal changes to existing code

**3. React Query Pattern**
- Current: Uses React Query for stores/products
- Multi-user: Same pattern, just different query
- No architectural changes needed

**4. RLS Policies**
- Current: RLS already checks `user_id`
- Multi-user: Update RLS to check `store_users` table
- Database-level security (good!)

---

## Implementation Complexity

### Easy Parts (⭐)
- ✅ Database schema (backward compatible)
- ✅ Migration script (straightforward)
- ✅ UI components (just add role badges)
- ✅ Type definitions (add role field)

### Medium Parts (⭐⭐)
- ⚠️ Query updates (need to join `store_users`)
- ⚠️ `requireStore()` function (add role checking)
- ⚠️ OAuth logic (handle multiple users)
- ⚠️ RLS policies (update to check `store_users`)

### Hard Parts (⭐⭐⭐)
- ⚠️ Invitation system (new feature, needs email service)
- ⚠️ Permission checks everywhere (need to add role checks)
- ⚠️ Testing (need to test all permission scenarios)

---

## Migration Path

### Phase 1: Database (Week 1) - Low Risk
```sql
-- 1. Create store_users table
-- 2. Add owner_id to stores
-- 3. Migrate existing stores
-- 4. Test queries
```
**Risk**: Low - Backward compatible, can rollback

### Phase 2: Core Functions (Week 1-2) - Medium Risk
```typescript
// 1. Update requireStore() to check store_users
// 2. Update useStores() to join store_users
// 3. Update tokenService to handle multi-user
// 4. Test all API routes
```
**Risk**: Medium - Core functionality, needs thorough testing

### Phase 3: UI Updates (Week 2-3) - Low Risk
```typescript
// 1. Add role badges
// 2. Add team management UI
// 3. Hide/show actions based on role
// 4. Test UI flows
```
**Risk**: Low - UI only, can disable if issues

### Phase 4: Invitation System (Week 3-4) - Medium Risk
```typescript
// 1. Invitation API endpoints
// 2. Email service
// 3. Acceptance flow
// 4. Test end-to-end
```
**Risk**: Medium - New feature, can disable if issues

---

## Code Examples

### Before (Current)
```typescript
// Get stores for user
const { data: stores } = await supabase
  .from('stores')
  .select('*')
  .eq('user_id', userId);  // Simple filter
```

### After (Multi-User)
```typescript
// Get stores user has access to
const { data: storeAccess } = await supabase
  .from('store_users')
  .select(`
    role,
    store:stores(*)
  `)
  .eq('user_id', userId)
  .eq('is_active', true);

const stores = storeAccess?.map(item => ({
  ...item.store,
  userRole: item.role,
})) || [];
```

**Change Complexity**: Medium - Need to update queries, but pattern is similar

---

### Before (Current)
```typescript
// Check store access
const { data: store } = await supabase
  .from('stores')
  .select('*')
  .eq('id', storeId)
  .eq('user_id', userId)  // Direct ownership check
  .single();
```

### After (Multi-User)
```typescript
// Check store access via store_users
const { data: access } = await supabase
  .from('store_users')
  .select('role, store:stores(*)')
  .eq('store_id', storeId)
  .eq('user_id', userId)
  .eq('is_active', true)
  .single();

if (!access) {
  throw new Error('Access denied');
}

const store = access.store;
const userRole = access.role;
```

**Change Complexity**: Medium - Similar pattern, just different table

---

## RLS Policy Updates

### Current RLS
```sql
-- Users can only see their own stores
CREATE POLICY stores_select_own ON stores
  FOR SELECT
  USING (user_id = current_user_id());
```

### New RLS (Multi-User)
```sql
-- Users can see stores they have access to
CREATE POLICY stores_select_accessible ON stores
  FOR SELECT
  USING (
    id IN (
      SELECT store_id FROM store_users
      WHERE user_id = current_user_id()
        AND is_active = true
    )
  );
```

**Change Complexity**: Easy - Just update policy, database handles it

---

## Testing Strategy

### Unit Tests
- Permission checking functions
- Role-based access control
- Store access queries

### Integration Tests
- API routes with different roles
- OAuth flow with existing stores
- Invitation acceptance flow

### E2E Tests
- Owner invites admin
- Admin tries to invite (should fail)
- Viewer tries to sync (should fail)
- Owner removes user

---

## Rollback Plan

### If Issues Arise
1. **Disable invitation system** (feature flag)
2. **Revert to single-user mode** (check `owner_id` only)
3. **Keep database changes** (backward compatible)
4. **Fix issues and re-enable**

### Database Rollback
```sql
-- If needed, can query by owner_id only
SELECT * FROM stores WHERE owner_id = user_id;
-- This works even with store_users table
```

---

## Summary

### Fit Assessment: ✅ **GOOD FIT**

**Why it fits well:**
1. ✅ Current architecture is already user-scoped
2. ✅ Feature-based structure makes it easy to add
3. ✅ React Query pattern supports it
4. ✅ RLS policies can be updated easily
5. ✅ Backward compatible migration

**Complexity: Medium**
- Database: Easy (backward compatible)
- Core functions: Medium (need query updates)
- UI: Easy (just add role badges)
- Invitations: Medium (new feature)

**Estimated Time: 3-4 weeks**
- Week 1: Database + Core functions
- Week 2: UI updates + Testing
- Week 3: Invitation system
- Week 4: Polish + Security audit

**Risk Level: Medium-Low**
- Can be done incrementally
- Backward compatible
- Can disable features if issues
- Good rollback plan

