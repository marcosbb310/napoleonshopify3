# Multi-User Store Support - Complete Implementation Guide

**Purpose**: Allow multiple users to access the same Shopify store with role-based permissions  
**Date**: November 15, 2024  
**Status**: Planning Phase - Ready for Implementation

---

## EXECUTIVE SUMMARY

### What We're Building

A multi-user store access system that allows:
- **Multiple users** to access the same Shopify store
- **Role-based permissions** (Owner, Admin, Viewer)
- **Invitation system** for adding team members
- **Security** to prevent unauthorized access

### Current State

- ✅ One user = One store (direct `user_id` relationship)
- ✅ Stores filtered by `user_id` in all queries
- ✅ `requireStore()` checks `user_id` match
- ✅ Feature-based architecture (good for adding this)

### Target State

- ✅ Multiple users = One store (via `store_users` junction table)
- ✅ Stores filtered by `store_users` table
- ✅ `requireStore()` checks `store_users` access + role
- ✅ Invitation system for adding users
- ✅ Permission-based UI and API routes

---

## DATABASE SCHEMA

### New Table: `store_users`

```sql
CREATE TABLE store_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'viewer')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One user can only have one role per store
  UNIQUE(store_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_store_users_store_id ON store_users(store_id);
CREATE INDEX idx_store_users_user_id ON store_users(user_id);
CREATE INDEX idx_store_users_role ON store_users(role);
CREATE INDEX idx_store_users_active ON store_users(is_active);
```

### Update `stores` Table

```sql
-- Add owner_id to track original owner
ALTER TABLE stores 
  ADD COLUMN owner_id UUID REFERENCES users(id);

-- Backfill: Set owner_id = user_id for existing stores
UPDATE stores 
SET owner_id = user_id 
WHERE owner_id IS NULL;

-- Make owner_id required for new stores (after migration)
-- ALTER TABLE stores ALTER COLUMN owner_id SET NOT NULL;
```

### Migration Script

```sql
-- Migration: Convert existing stores to multi-user format
-- File: supabase/migrations/030_add_multi_user_store_support.sql

-- Step 1: Create store_users table
CREATE TABLE IF NOT EXISTS store_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'viewer')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_users_store_id ON store_users(store_id);
CREATE INDEX IF NOT EXISTS idx_store_users_user_id ON store_users(user_id);
CREATE INDEX IF NOT EXISTS idx_store_users_role ON store_users(role);
CREATE INDEX IF NOT EXISTS idx_store_users_active ON store_users(is_active);

-- Step 2: Add owner_id to stores
ALTER TABLE stores 
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);

-- Step 3: Migrate existing stores
-- Convert all existing stores to have owner in store_users
INSERT INTO store_users (store_id, user_id, role, accepted_at, is_active)
SELECT id, user_id, 'owner', NOW(), true
FROM stores
WHERE is_active = true
ON CONFLICT (store_id, user_id) DO NOTHING;

-- Step 4: Set owner_id for existing stores
UPDATE stores 
SET owner_id = user_id 
WHERE owner_id IS NULL;

-- Step 5: Add updated_at trigger
CREATE TRIGGER update_store_users_updated_at 
  BEFORE UPDATE ON store_users
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
```

---

## ROLE-BASED PERMISSIONS

### Permission Matrix

| Action | Owner | Admin | Viewer |
|--------|-------|-------|--------|
| View products | ✅ | ✅ | ✅ |
| View analytics | ✅ | ✅ | ✅ |
| Sync products | ✅ | ✅ | ❌ |
| Update prices | ✅ | ✅ | ❌ |
| Manage products | ✅ | ✅ | ❌ |
| Invite users | ✅ | ❌ | ❌ |
| Remove users | ✅ | ❌ | ❌ |
| Change roles | ✅ | ❌ | ❌ |
| Disconnect store | ✅ | ❌ | ❌ |
| Delete store | ✅ | ❌ | ❌ |

### Permission Checking Service

**File**: `src/shared/lib/storePermissions.ts`

```typescript
export type StoreRole = 'owner' | 'admin' | 'viewer';

export interface StorePermission {
  canInviteUsers: boolean;
  canRemoveUsers: boolean;
  canChangeRoles: boolean;
  canDisconnectStore: boolean;
  canManageProducts: boolean;
  canUpdatePricing: boolean;
  canViewAnalytics: boolean;
  canRunSync: boolean;
}

export function getStorePermissions(role: StoreRole): StorePermission {
  switch (role) {
    case 'owner':
      return {
        canInviteUsers: true,
        canRemoveUsers: true,
        canChangeRoles: true,
        canDisconnectStore: true,
        canManageProducts: true,
        canUpdatePricing: true,
        canViewAnalytics: true,
        canRunSync: true,
      };
    case 'admin':
      return {
        canInviteUsers: false,
        canRemoveUsers: false,
        canChangeRoles: false,
        canDisconnectStore: false,
        canManageProducts: true,
        canUpdatePricing: true,
        canViewAnalytics: true,
        canRunSync: true,
      };
    case 'viewer':
      return {
        canInviteUsers: false,
        canRemoveUsers: false,
        canChangeRoles: false,
        canDisconnectStore: false,
        canManageProducts: false,
        canUpdatePricing: false,
        canViewAnalytics: true,
        canRunSync: false,
      };
  }
}

export function hasPermission(
  role: StoreRole,
  permission: keyof StorePermission
): boolean {
  return getStorePermissions(role)[permission];
}
```

---

## CORE FUNCTION UPDATES

### 1. Update `requireStore()` - src/shared/lib/apiAuth.ts

**Current (line 75-82):**
```typescript
// Single query with all conditions (store exists, belongs to user, and is active)
const { data: store, error: storeError } = await supabaseAdmin
  .from('stores')
  .select('*')
  .eq('id', storeId)
  .eq('user_id', userProfile.id)  // ❌ Only checks direct ownership
  .eq('is_active', true)
  .single();
```

**New:**
```typescript
// Check if user has access via store_users table
const { data: storeAccess, error: accessError } = await supabaseAdmin
  .from('store_users')
  .select(`
    role,
    is_active,
    store:stores(*)
  `)
  .eq('store_id', storeId)
  .eq('user_id', userProfile.id)
  .eq('is_active', true)
  .single();

if (accessError || !storeAccess || !storeAccess.store) {
  console.error('❌ requireStore: Access denied:', {
    storeId,
    userId: userProfile.id,
    error: accessError,
  });
  return { 
    user, 
    store: null, 
    access: null,
    error: NextResponse.json({ error: 'Store not found or access denied' }, { status: 403 }) 
  };
}

// Check if store is active
if (!storeAccess.store.is_active) {
  return { 
    user, 
    store: null, 
    access: null,
    error: NextResponse.json({ error: 'Store is inactive' }, { status: 403 }) 
  };
}

// Return store with access info
return { 
  user, 
  store: storeAccess.store, 
  access: {
    role: storeAccess.role as StoreRole,
    permissions: getStorePermissions(storeAccess.role as StoreRole),
  },
  error: null 
};
```

**Function Signature Change:**
```typescript
// Before
export async function requireStore(
  request: NextRequest, 
  options?: { allowBody?: boolean; storeId?: string }
): Promise<{ user: User | null; store: Store | null; error: NextResponse | null }>

// After
export async function requireStore(
  request: NextRequest, 
  options?: { allowBody?: boolean; storeId?: string; requiredRole?: StoreRole }
): Promise<{ 
  user: User | null; 
  store: Store | null; 
  access: { role: StoreRole; permissions: StorePermission } | null;
  error: NextResponse | null 
}>
```

---

### 2. Update `useStores()` - src/features/shopify-integration/hooks/useStores.ts

**Current (line 52-67):**
```typescript
const { data, error } = await supabase
  .from('stores')
  .select(`
    id,
    shop_domain,
    scope,
    installed_at,
    last_synced_at,
    is_active,
    created_at,
    updated_at,
    user_id
  `)
  .eq('is_active', true)
  .eq('user_id', user.id)  // ❌ Direct user_id filter
  .order('updated_at', { ascending: false })
```

**New:**
```typescript
// Get user profile first
const { data: userProfile } = await supabase
  .from('users')
  .select('id')
  .eq('auth_user_id', user.id)
  .single();

if (!userProfile) {
  return { stores: [], isLoading: false, error: new Error('User profile not found') };
}

// Get stores via store_users join
const { data: storeAccessData, error } = await supabase
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
  .eq('store.is_active', true)
  .order('store.updated_at', { ascending: false });

if (error) {
  console.error('❌ Failed to fetch stores:', error);
  throw error;
}

// Transform to include role
const storesWithRole: Store[] = (storeAccessData || []).map(item => ({
  ...item.store,
  userRole: item.role,  // Add role to store object
}));
```

**Interface Update:**
```typescript
export interface Store {
  id: string;
  shop_domain: string;
  scope: string;
  installed_at: string;
  last_synced_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  owner_id: string;
  userRole?: 'owner' | 'admin' | 'viewer';  // NEW: User's role for this store
  connection_status?: 'connected' | 'disconnected';
  product_count?: number;
  last_sync_status?: 'success' | 'failed' | 'pending';
}
```

---

### 3. Update `encryptAndStoreTokens()` - src/features/shopify-oauth/services/tokenService.ts

**Current (line 63-111):**
```typescript
// Check if store already exists for this user
const { data: existingStore } = await supabase
  .from('stores')
  .select('id')
  .eq('shop_domain', shopDomain)
  .eq('user_id', userId)
  .single();

if (existingStore) {
  // Update existing store
  // ...
} else {
  // Create new store
  // ...
}
```

**New:**
```typescript
// Step 1: Check if store exists (any user)
const { data: existingStore } = await supabase
  .from('stores')
  .select('id, owner_id')
  .eq('shop_domain', shopDomain)
  .maybeSingle();

if (existingStore) {
  // Store exists - check if user has access
  const { data: existingAccess } = await supabase
    .from('store_users')
    .select('role')
    .eq('store_id', existingStore.id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  
  if (existingAccess) {
    // User already has access - update tokens (reconnect)
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        access_token: tokens.accessToken,
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
    // Store exists but user doesn't have access
    // If store has no owner, make this user the owner
    if (!existingStore.owner_id) {
      // Add user as owner
      await supabase.from('store_users').insert({
        store_id: existingStore.id,
        user_id: userId,
        role: 'owner',
        accepted_at: new Date().toISOString(),
        is_active: true,
      });
      
      // Update store owner_id
      await supabase
        .from('stores')
        .update({ owner_id: userId })
        .eq('id', existingStore.id);
      
      // Update tokens
      await supabase
        .from('stores')
        .update({
          access_token: tokens.accessToken,
          access_token_encrypted: encryptedToken,
          scope: tokens.scope,
          is_active: true,
        })
        .eq('id', existingStore.id);
      
      return existingStore.id;
    } else {
      // Store has owner - prevent unauthorized connection
      throw new Error(
        `This Shopify store is already connected to another account. ` +
        `If you believe this is an error, please contact support. ` +
        `To reconnect your store, please disconnect it first from the other account.`
      );
    }
  }
} else {
  // Store doesn't exist - create new store and add user as owner
  const { data: newStore, error: insertError } = await supabase
    .from('stores')
    .insert({
      owner_id: userId,
      shop_domain: shopDomain,
      access_token: tokens.accessToken,
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
  
  // Add user as owner in store_users
  await supabase.from('store_users').insert({
    store_id: newStore.id,
    user_id: userId,
    role: 'owner',
    accepted_at: new Date().toISOString(),
    is_active: true,
  });
  
  return newStore.id;
}
```

---

## NEW SERVICES & HOOKS

### Store Users Service

**File**: `src/features/shopify-integration/services/storeUsersService.ts`

```typescript
import { createAdminClient } from '@/shared/lib/supabase';
import type { StoreRole } from '@/shared/lib/storePermissions';

export interface StoreUser {
  id: string;
  store_id: string;
  user_id: string;
  role: StoreRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  is_active: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export async function getStoreUsers(storeId: string): Promise<StoreUser[]> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('store_users')
    .select(`
      *,
      user:users(id, email, name)
    `)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('role', { ascending: false })
    .order('accepted_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function inviteUserToStore(
  storeId: string,
  email: string,
  role: StoreRole,
  invitedBy: string
): Promise<{ invitationId: string }> {
  const supabase = createAdminClient();
  
  // Find user by email
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();
  
  if (!user) {
    throw new Error('User not found. They must sign up first.');
  }
  
  // Check if user already has access
  const { data: existing } = await supabase
    .from('store_users')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .single();
  
  if (existing) {
    throw new Error('User already has access to this store');
  }
  
  // Create invitation (accepted_at is null)
  const { data: invitation, error } = await supabase
    .from('store_users')
    .insert({
      store_id: storeId,
      user_id: user.id,
      role,
      invited_by: invitedBy,
      invited_at: new Date().toISOString(),
      accepted_at: null,  // Not accepted yet
      is_active: true,
    })
    .select('id')
    .single();
  
  if (error) throw error;
  
  return { invitationId: invitation.id };
}

export async function acceptInvitation(invitationId: string): Promise<void> {
  const supabase = createAdminClient();
  
  const { error } = await supabase
    .from('store_users')
    .update({
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invitationId);
  
  if (error) throw error;
}

export async function removeUserFromStore(
  storeId: string,
  userId: string,
  removedBy: string
): Promise<void> {
  const supabase = createAdminClient();
  
  // Verify remover has permission (must be owner)
  const { data: removerAccess } = await supabase
    .from('store_users')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', removedBy)
    .eq('role', 'owner')
    .single();
  
  if (!removerAccess) {
    throw new Error('Only store owners can remove users');
  }
  
  // Cannot remove owner if they're the only owner
  const { data: userAccess } = await supabase
    .from('store_users')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .single();
  
  if (userAccess?.role === 'owner') {
    // Check if there are other owners
    const { count } = await supabase
      .from('store_users')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('role', 'owner')
      .eq('is_active', true);
    
    if (count === 1) {
      throw new Error('Cannot remove the only owner. Transfer ownership first.');
    }
  }
  
  // Deactivate access
  const { error } = await supabase
    .from('store_users')
    .update({ is_active: false })
    .eq('store_id', storeId)
    .eq('user_id', userId);
  
  if (error) throw error;
}

export async function changeUserRole(
  storeId: string,
  userId: string,
  newRole: StoreRole,
  changedBy: string
): Promise<void> {
  const supabase = createAdminClient();
  
  // Verify changer has permission (must be owner)
  const { data: changerAccess } = await supabase
    .from('store_users')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', changedBy)
    .eq('role', 'owner')
    .single();
  
  if (!changerAccess) {
    throw new Error('Only store owners can change roles');
  }
  
  // Cannot change owner role if they're the only owner
  const { data: userAccess } = await supabase
    .from('store_users')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .single();
  
  if (userAccess?.role === 'owner' && newRole !== 'owner') {
    const { count } = await supabase
      .from('store_users')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('role', 'owner')
      .eq('is_active', true);
    
    if (count === 1) {
      throw new Error('Cannot change role of the only owner');
    }
  }
  
  // Update role
  const { error } = await supabase
    .from('store_users')
    .update({ role: newRole })
    .eq('store_id', storeId)
    .eq('user_id', userId);
  
  if (error) throw error;
}
```

---

### Store Access Hook

**File**: `src/features/shopify-integration/hooks/useStoreAccess.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/shared/lib/supabase';
import type { StoreRole } from '@/shared/lib/storePermissions';

export function useStoreAccess(storeId?: string) {
  const supabase = createClient();
  
  return useQuery({
    queryKey: ['store-access', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: userProfile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
      
      if (!userProfile) return null;
      
      const { data: access, error } = await supabase
        .from('store_users')
        .select('role, is_active')
        .eq('store_id', storeId)
        .eq('user_id', userProfile.id)
        .eq('is_active', true)
        .single();
      
      if (error || !access) return null;
      
      return {
        role: access.role as StoreRole,
        hasAccess: true,
      };
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });
}
```

---

## API ROUTES

### Invite User Endpoint

**File**: `src/app/api/stores/[storeId]/invite/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { inviteUserToStore } from '@/features/shopify-integration/services/storeUsersService';
import { sendInvitationEmail } from '@/features/shopify-integration/services/emailService';

export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const { user, store, access, error } = await requireStore(request, { 
      storeId: params.storeId 
    });
    
    if (error) return error;
    if (!store || !access) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    
    // Check permission
    if (!access.permissions.canInviteUsers) {
      return NextResponse.json(
        { error: 'You do not have permission to invite users' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { email, role } = body;
    
    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      );
    }
    
    // Get user profile for invitedBy
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }
    
    // Invite user
    const { invitationId } = await inviteUserToStore(
      store.id,
      email,
      role,
      userProfile.id
    );
    
    // Send invitation email
    await sendInvitationEmail(email, store.shop_domain, invitationId);
    
    return NextResponse.json({
      success: true,
      message: 'Invitation sent',
      invitationId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### Remove User Endpoint

**File**: `src/app/api/stores/[storeId]/users/[userId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { removeUserFromStore } from '@/features/shopify-integration/services/storeUsersService';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { storeId: string; userId: string } }
) {
  try {
    const { user, store, access, error } = await requireStore(request, { 
      storeId: params.storeId 
    });
    
    if (error) return error;
    if (!store || !access) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    
    // Check permission
    if (!access.permissions.canRemoveUsers) {
      return NextResponse.json(
        { error: 'You do not have permission to remove users' },
        { status: 403 }
      );
    }
    
    // Get user profile for removedBy
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }
    
    // Remove user
    await removeUserFromStore(
      store.id,
      params.userId,
      userProfile.id
    );
    
    return NextResponse.json({
      success: true,
      message: 'User removed from store',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

## RLS POLICIES

### Update Stores RLS

```sql
-- Drop old policy
DROP POLICY IF EXISTS stores_select_own ON stores;

-- New policy: Users can see stores they have access to
CREATE POLICY stores_select_accessible ON stores
  FOR SELECT
  USING (
    id IN (
      SELECT store_id FROM store_users
      WHERE user_id IN (
        SELECT id FROM users WHERE auth_user_id = auth.uid()
      )
      AND is_active = true
    )
  );
```

### Store Users RLS

```sql
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;

-- Users can see their own store access
CREATE POLICY store_users_select_own ON store_users
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Owners can manage store_users for their stores
CREATE POLICY store_users_manage_by_owner ON store_users
  FOR ALL
  USING (
    store_id IN (
      SELECT store_id FROM store_users
      WHERE user_id IN (
        SELECT id FROM users WHERE auth_user_id = auth.uid()
      )
      AND role = 'owner'
      AND is_active = true
    )
  );
```

---

## UI COMPONENTS

### Store Settings with Team Management

**File**: `src/features/shopify-integration/components/StoreTeamManagement.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useStoreUsers } from '@/features/shopify-integration/hooks/useStoreUsers';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { toast } from 'sonner';
import { UserPlus, X, Mail } from 'lucide-react';

export function StoreTeamManagement({ storeId }: { storeId: string }) {
  const { users, isLoading, refetch } = useStoreUsers(storeId);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'viewer'>('admin');
  const [isInviting, setIsInviting] = useState(false);
  
  const currentUser = users?.find(u => u.isCurrentUser);
  const canInvite = currentUser?.role === 'owner';
  
  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }
    
    setIsInviting(true);
    try {
      const response = await fetch(`/api/stores/${storeId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }
      
      toast.success('Invitation sent!');
      setInviteEmail('');
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };
  
  const handleRemove = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;
    
    try {
      const response = await fetch(`/api/stores/${storeId}/users/${userId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove user');
      }
      
      toast.success('User removed');
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove user');
    }
  };
  
  if (isLoading) {
    return <div>Loading team...</div>;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Invite Form */}
        {canInvite && (
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'viewer')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={isInviting}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite
            </Button>
          </div>
        )}
        
        {/* User List */}
        <div className="space-y-2">
          {users?.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-medium">{user.user?.name || user.user?.email}</div>
                  <div className="text-sm text-muted-foreground">{user.user?.email}</div>
                </div>
                <Badge variant={user.role === 'owner' ? 'default' : 'secondary'}>
                  {user.role}
                </Badge>
                {user.isCurrentUser && (
                  <Badge variant="outline">You</Badge>
                )}
              </div>
              {canInvite && !user.isCurrentUser && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(user.user_id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## IMPLEMENTATION PHASES

### Phase 1: Database & Core Functions (Week 1)

**Tasks:**
1. Create migration file: `030_add_multi_user_store_support.sql`
2. Run migration in Supabase
3. Update `requireStore()` function
4. Update `useStores()` hook
5. Update `encryptAndStoreTokens()` service
6. Test core functionality

**Files to Change:**
- `supabase/migrations/030_add_multi_user_store_support.sql` (NEW)
- `src/shared/lib/apiAuth.ts`
- `src/shared/lib/storePermissions.ts` (NEW)
- `src/features/shopify-integration/hooks/useStores.ts`
- `src/features/shopify-oauth/services/tokenService.ts`

**Testing:**
- Verify existing stores still work
- Test store access queries
- Test OAuth connection flow

---

### Phase 2: UI Updates (Week 2)

**Tasks:**
1. Add role badges to store cards
2. Create team management component
3. Add permission checks to UI actions
4. Update store settings page

**Files to Change:**
- `src/features/shopify-integration/components/StoreTeamManagement.tsx` (NEW)
- `src/features/shopify-integration/components/StoreConnectionCard.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/features/shopify-integration/hooks/useStoreAccess.ts` (NEW)

**Testing:**
- Test UI with different roles
- Verify actions are hidden/shown correctly
- Test team management UI

---

### Phase 3: Invitation System (Week 3)

**Tasks:**
1. Create invitation API endpoints
2. Create email service
3. Create invitation acceptance flow
4. Add invitation UI

**Files to Create:**
- `src/app/api/stores/[storeId]/invite/route.ts` (NEW)
- `src/app/api/stores/invitations/[invitationId]/accept/route.ts` (NEW)
- `src/features/shopify-integration/services/emailService.ts` (NEW)
- `src/features/shopify-integration/hooks/useStoreUsers.ts` (NEW)

**Testing:**
- Test invitation flow end-to-end
- Test email delivery
- Test invitation acceptance

---

### Phase 4: Security & Polish (Week 4)

**Tasks:**
1. Update RLS policies
2. Add permission checks to all API routes
3. Add audit logging
4. Security testing
5. Documentation

**Files to Change:**
- All API routes (add permission checks)
- RLS policies in migration
- Add audit logging service

**Testing:**
- Security audit
- Permission testing
- Load testing

---

## TESTING CHECKLIST

### Unit Tests
- [ ] Permission checking functions
- [ ] Role-based access control
- [ ] Store access queries
- [ ] Invitation service functions

### Integration Tests
- [ ] API routes with different roles
- [ ] OAuth flow with existing stores
- [ ] Invitation acceptance flow
- [ ] User removal flow

### E2E Tests
- [ ] Owner invites admin
- [ ] Admin tries to invite (should fail)
- [ ] Viewer tries to sync (should fail)
- [ ] Owner removes user
- [ ] Owner changes user role
- [ ] Multiple users access same store

### Security Tests
- [ ] Unauthorized access attempts
- [ ] Permission bypass attempts
- [ ] RLS policy verification
- [ ] Token security

---

## ROLLBACK PLAN

### If Issues Arise

**Step 1: Disable Features**
- Add feature flag: `ENABLE_MULTI_USER_STORES=false`
- Revert to single-user queries if flag is false

**Step 2: Database Rollback**
```sql
-- Query by owner_id only (backward compatible)
SELECT * FROM stores WHERE owner_id = user_id;
```

**Step 3: Code Rollback**
- Revert `requireStore()` to check `user_id` directly
- Revert `useStores()` to query `stores` directly
- Keep database changes (they're backward compatible)

**Step 4: Fix and Re-enable**
- Fix issues
- Re-enable features
- Test thoroughly

---

## SUCCESS CRITERIA

### Phase 1 Complete
- [ ] Database migration runs successfully
- [ ] Existing stores still work
- [ ] `requireStore()` checks `store_users` table
- [ ] `useStores()` returns stores with roles
- [ ] OAuth creates stores with owner in `store_users`

### Phase 2 Complete
- [ ] UI shows role badges
- [ ] Actions are hidden/shown based on role
- [ ] Team management component works
- [ ] Store settings page updated

### Phase 3 Complete
- [ ] Invitation API works
- [ ] Emails are sent
- [ ] Invitations can be accepted
- [ ] Users appear in team list after acceptance

### Phase 4 Complete
- [ ] RLS policies work correctly
- [ ] All API routes check permissions
- [ ] Security audit passes
- [ ] Documentation complete

---

## ESTIMATED TIMELINE

| Phase | Duration | Risk |
|-------|----------|------|
| Phase 1: Database & Core | 1 week | Medium |
| Phase 2: UI Updates | 1 week | Low |
| Phase 3: Invitations | 1 week | Medium |
| Phase 4: Security & Polish | 1 week | Low |
| **Total** | **4 weeks** | **Medium** |

---

## FILES SUMMARY

### Files to Create (New)
1. `supabase/migrations/030_add_multi_user_store_support.sql`
2. `src/shared/lib/storePermissions.ts`
3. `src/features/shopify-integration/services/storeUsersService.ts`
4. `src/features/shopify-integration/hooks/useStoreAccess.ts`
5. `src/features/shopify-integration/hooks/useStoreUsers.ts`
6. `src/features/shopify-integration/components/StoreTeamManagement.tsx`
7. `src/features/shopify-integration/services/emailService.ts`
8. `src/app/api/stores/[storeId]/invite/route.ts`
9. `src/app/api/stores/[storeId]/users/[userId]/route.ts`
10. `src/app/api/stores/invitations/[invitationId]/accept/route.ts`

### Files to Update (Existing)
1. `src/shared/lib/apiAuth.ts` - Update `requireStore()`
2. `src/features/shopify-integration/hooks/useStores.ts` - Update query
3. `src/features/shopify-oauth/services/tokenService.ts` - Update OAuth logic
4. `src/app/api/stores/route.ts` - Update API endpoint
5. `src/features/auth/hooks/useCurrentStore.ts` - Add role info
6. `src/app/(app)/settings/page.tsx` - Add team management
7. `src/features/shopify-integration/components/StoreConnectionCard.tsx` - Add role badge
8. All API routes that use `requireStore()` - Add role checks

**Total**: ~10 new files, ~15 updated files

---

## NOTES

- All changes are backward compatible
- Existing stores will continue to work
- Can be implemented incrementally
- Good rollback plan
- Follows current architecture patterns

