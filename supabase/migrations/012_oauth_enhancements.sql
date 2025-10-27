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
