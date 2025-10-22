-- Fix Users Table RLS and Add Unique Constraint
-- This fixes the conflict between old migration 007 and new migration 008

-- Drop old conflicting RLS policies from migration 007
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_update_own ON users;

-- Add unique constraint for auth_user_id (should be one-to-one)
ALTER TABLE users ADD CONSTRAINT users_auth_user_id_unique UNIQUE (auth_user_id);

-- Create new RLS policies using auth_user_id instead of id
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth_user_id = auth.uid());

CREATE POLICY users_insert_own ON users
  FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

-- Allow service role to bypass RLS for the trigger
ALTER TABLE users FORCE ROW LEVEL SECURITY;

