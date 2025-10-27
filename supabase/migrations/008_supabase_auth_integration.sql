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

