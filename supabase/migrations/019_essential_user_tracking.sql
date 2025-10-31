-- ============================================================================
-- Essential User Tracking Fields
-- Adds critical user lifecycle and engagement tracking
-- ============================================================================

-- Add essential tracking fields to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Create index for engagement queries (finding inactive users, etc.)
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity_at DESC);

-- Update trigger to track last_activity_at on any user update
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_last_activity ON users;
CREATE TRIGGER trigger_update_last_activity
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_last_activity();

-- Function to update user login tracking
CREATE OR REPLACE FUNCTION track_user_login(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET 
    last_login_at = NOW(),
    login_count = COALESCE(login_count, 0) + 1,
    last_activity_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN users.email_verified IS 'Whether user has verified their email address';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last successful login';
COMMENT ON COLUMN users.last_activity_at IS 'Timestamp of last user activity (updated on any user action)';
COMMENT ON COLUMN users.login_count IS 'Total number of successful logins';

