# Multi-User Store Support - Implementation Plan

## Overview

Allow multiple users to access the same Shopify store with role-based permissions, while maintaining security and data integrity.

---

## Database Schema Changes

### New Table: `store_users` (Junction Table)

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

-- Make owner_id required for new stores
ALTER TABLE stores 
  ALTER COLUMN owner_id SET NOT NULL;
```

### Migration Strategy

```sql
-- Migration: Convert existing stores to multi-user format
DO $$
DECLARE
  store_record RECORD;
BEGIN
  -- For each existing store, create owner record in store_users
  FOR store_record IN SELECT id, user_id FROM stores LOOP
    INSERT INTO store_users (store_id, user_id, role, accepted_at, is_active)
    VALUES (
      store_record.id,
      store_record.user_id,
      'owner',
      NOW(),
      true
    )
    ON CONFLICT (store_id, user_id) DO NOTHING;
    
    -- Set owner_id
    UPDATE stores 
    SET owner_id = store_record.user_id 
    WHERE id = store_record.id;
  END LOOP;
END $$;
```

---

## Role-Based Permissions

### Roles

| Role | Permissions |
|------|------------|
| **Owner** | • Full control<br>• Invite/remove users<br>• Change roles<br>• Disconnect store<br>• Delete store |
| **Admin** | • Manage products<br>• Update pricing<br>• Run syncs<br>• View analytics<br>• Cannot invite users<br>• Cannot disconnect store |
| **Viewer** | • View products<br>• View analytics<br>• Read-only access<br>• Cannot modify anything |

### Permission Checks

```typescript
// src/shared/lib/storePermissions.ts

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
```

---

## Security Measures

### 1. OAuth Connection Rules

```typescript
// Updated tokenService.ts logic

// When connecting a store:
// 1. Check if store exists (any user)
// 2. If exists:
//    - If user is owner → update tokens
//    - If user has access → update tokens
//    - If user has no access → ERROR
// 3. If doesn't exist → create store, set user as owner
```

### 2. API Route Protection

```typescript
// src/shared/lib/apiAuth.ts

export async function requireStoreAccess(
  request: NextRequest,
  storeId: string,
  requiredRole?: StoreRole
) {
  const { user, error } = await requireAuth(request);
  if (error) return { user: null, store: null, access: null, error };
  
  // Get user profile
  const userProfile = await getUserProfile(user.id);
  if (!userProfile) {
    return { 
      user, 
      store: null, 
      access: null, 
      error: NextResponse.json({ error: 'User profile not found' }, { status: 404 }) 
    };
  }
  
  // Get store
  const store = await getStore(storeId);
  if (!store) {
    return { 
      user, 
      store: null, 
      access: null, 
      error: NextResponse.json({ error: 'Store not found' }, { status: 404 }) 
    };
  }
  
  // Check if user has access
  const access = await getStoreAccess(userProfile.id, storeId);
  if (!access || !access.is_active) {
    return { 
      user, 
      store: null, 
      access: null, 
      error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) 
    };
  }
  
  // Check role if required
  if (requiredRole) {
    const roleHierarchy = { owner: 3, admin: 2, viewer: 1 };
    if (roleHierarchy[access.role] < roleHierarchy[requiredRole]) {
      return { 
        user, 
        store, 
        access, 
        error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) 
      };
    }
  }
  
  return { user, store, access, error: null };
}
```

### 3. RLS Policies

```sql
-- Row Level Security for store_users
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;

-- Users can see their own store access
CREATE POLICY "Users can view their own store access"
  ON store_users
  FOR SELECT
  USING (auth.uid() IN (
    SELECT auth_user_id FROM users WHERE id = store_users.user_id
  ));

-- Owners can manage store_users for their stores
CREATE POLICY "Owners can manage store_users"
  ON store_users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM store_users su
      JOIN users u ON su.user_id = u.id
      WHERE su.store_id = store_users.store_id
        AND su.role = 'owner'
        AND u.auth_user_id = auth.uid()
    )
  );
```

---

## User Experience

### 1. Store Connection Flow

**First User (Owner):**
1. User connects store via OAuth
2. Store is created
3. User automatically becomes "owner"
4. Store appears in their list

**Subsequent Users:**
1. Owner invites user via email
2. User receives invitation email
3. User accepts invitation
4. Store appears in their list with their role badge

### 2. Store Settings UI

```
Store Settings
├── Store Info
│   ├── Shop Domain: mystore.myshopify.com
│   ├── Connected: Oct 25, 2024
│   └── Status: Active
│
├── Team (Owner only)
│   ├── [Invite User Button]
│   ├── User List:
│   │   ├── You (Owner) [Remove] [Change Role]
│   │   ├── john@example.com (Admin) [Remove] [Change Role]
│   │   └── jane@example.com (Viewer) [Remove] [Change Role]
│   └── Pending Invitations:
│       └── bob@example.com (Admin) - Sent 2 days ago [Resend] [Cancel]
│
└── Danger Zone (Owner only)
    ├── [Disconnect Store]
    └── [Delete Store]
```

### 3. Permission-Based UI

```typescript
// Products page shows/hides actions based on role
{access.role !== 'viewer' && (
  <Button onClick={handleSync}>Sync Products</Button>
)}

{access.role === 'owner' && (
  <Button onClick={handleDisconnect}>Disconnect Store</Button>
)}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create `store_users` table
- [ ] Add `owner_id` to `stores` table
- [ ] Migration script for existing stores
- [ ] Basic permission checking functions

### Phase 2: OAuth Updates (Week 1-2)
- [ ] Update OAuth callback to check `store_users` table
- [ ] Allow multiple users to connect same store
- [ ] Set first user as owner
- [ ] Update `requireStore()` to check `store_users`

### Phase 3: Invitation System (Week 2-3)
- [ ] Invitation API endpoints
- [ ] Email invitation service
- [ ] Invitation acceptance flow
- [ ] Pending invitations UI

### Phase 4: UI Updates (Week 3-4)
- [ ] Store settings page with team management
- [ ] Role badges throughout UI
- [ ] Permission-based action visibility
- [ ] User removal/role change UI

### Phase 5: Security Hardening (Week 4)
- [ ] RLS policies
- [ ] API route protection
- [ ] Audit logging
- [ ] Security testing

---

## Security Checklist

### Data Protection
- [x] RLS policies prevent unauthorized access
- [x] API routes check permissions
- [x] Only owners can invite/remove users
- [x] Store tokens encrypted (already done)
- [x] Audit log for all permission changes

### User Experience
- [x] Clear role indicators
- [x] Permission errors are user-friendly
- [x] Invitation emails are secure
- [x] Users can see who has access

### Edge Cases
- [x] What if owner deletes account? → Transfer ownership
- [x] What if all users removed? → Store becomes orphaned (prevent this)
- [x] What if user tries to connect already-connected store? → Add to existing store_users
- [x] What if invitation expires? → Auto-delete after 7 days

---

## Example API Endpoints

### Invite User
```typescript
POST /api/stores/[storeId]/invite
{
  email: "user@example.com",
  role: "admin"
}
```

### Accept Invitation
```typescript
POST /api/stores/invitations/[invitationId]/accept
```

### Remove User
```typescript
DELETE /api/stores/[storeId]/users/[userId]
// Only owner can do this
```

### Change Role
```typescript
PATCH /api/stores/[storeId]/users/[userId]
{
  role: "admin"
}
// Only owner can do this
```

---

## Migration Path

1. **Deploy database changes** (backward compatible)
2. **Run migration script** (converts existing stores)
3. **Deploy code changes** (gradual rollout)
4. **Monitor for issues**
5. **Enable invitation system**
6. **Document for users**

---

## Testing Strategy

1. **Unit Tests**: Permission checking functions
2. **Integration Tests**: API routes with different roles
3. **E2E Tests**: Full invitation flow
4. **Security Tests**: Unauthorized access attempts
5. **Load Tests**: Multiple users accessing same store

---

## Rollback Plan

If issues arise:
1. Disable invitation system (feature flag)
2. Revert to single-user mode
3. Keep database changes (backward compatible)
4. Fix issues and re-enable

---

## Future Enhancements

1. **Team Management**: Organization-level permissions
2. **Activity Logs**: Track who did what
3. **Two-Factor Auth**: For store operations
4. **Store Templates**: Pre-configured settings
5. **API Keys**: For programmatic access

