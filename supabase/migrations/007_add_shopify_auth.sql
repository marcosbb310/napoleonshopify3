-- Add Shopify OAuth Authentication and Multi-Store Support
-- This migration adds users and stores tables for production authentication
-- Created: October 19, 2025

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores user account information
-- Each user can have multiple Shopify stores connected
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add updated_at trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comment
COMMENT ON TABLE users IS 'User accounts that can connect multiple Shopify stores';

-- ============================================================================
-- STORES TABLE
-- ============================================================================
-- Stores Shopify store connection information
-- Each store belongs to one user and contains OAuth credentials
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_domain TEXT UNIQUE NOT NULL, -- e.g., "mystore.myshopify.com"
  access_token TEXT NOT NULL, -- Shopify OAuth access token (encrypted in production)
  scope TEXT NOT NULL, -- OAuth scopes granted (e.g., "read_products,write_products")
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ, -- Last time products/orders were synced
  is_active BOOLEAN DEFAULT TRUE, -- Allow users to temporarily disable a store
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_shop_domain ON stores(shop_domain);
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active);

-- Add updated_at trigger for stores table
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE stores IS 'Shopify store connections with OAuth credentials';
COMMENT ON COLUMN stores.shop_domain IS 'Shopify store domain (e.g., mystore.myshopify.com)';
COMMENT ON COLUMN stores.access_token IS 'Shopify OAuth access token - should be encrypted in production';
COMMENT ON COLUMN stores.scope IS 'OAuth scopes granted during installation';
COMMENT ON COLUMN stores.is_active IS 'Allows users to temporarily disable a store without deleting it';

-- ============================================================================
-- UPDATE PRODUCTS TABLE
-- ============================================================================
-- Add store_id foreign key to products table
-- This links each product to a specific Shopify store
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- Add index for store_id lookups (critical for multi-store filtering)
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);

-- Add composite index for common query pattern (store + shopify_id)
CREATE INDEX IF NOT EXISTS idx_products_store_shopify ON products(store_id, shopify_id);

-- Add helpful comment
COMMENT ON COLUMN products.store_id IS 'Links product to a specific Shopify store for multi-store support';

-- ============================================================================
-- UPDATE SALES_DATA TABLE
-- ============================================================================
-- Add store_id to sales_data for better query performance
-- This denormalizes the data but significantly improves analytics queries
ALTER TABLE sales_data 
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- Add index for store-specific sales queries
CREATE INDEX IF NOT EXISTS idx_sales_data_store_id ON sales_data(store_id);

-- Add composite index for common analytics query pattern
CREATE INDEX IF NOT EXISTS idx_sales_data_store_date ON sales_data(store_id, date DESC);

-- Add helpful comment
COMMENT ON COLUMN sales_data.store_id IS 'Denormalized store_id for faster analytics queries';

-- ============================================================================
-- UPDATE PRICING_HISTORY TABLE
-- ============================================================================
-- Add store_id to pricing_history for audit trail filtering
ALTER TABLE pricing_history 
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- Add index for store-specific history queries
CREATE INDEX IF NOT EXISTS idx_pricing_history_store_id ON pricing_history(store_id);

-- Add composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_pricing_history_store_timestamp ON pricing_history(store_id, timestamp DESC);

-- Add helpful comment
COMMENT ON COLUMN pricing_history.store_id IS 'Denormalized store_id for faster history queries';

-- ============================================================================
-- UPDATE ALGORITHM_RUNS TABLE
-- ============================================================================
-- Add store_id to algorithm_runs to track per-store execution
ALTER TABLE algorithm_runs 
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- Add index for store-specific run history
CREATE INDEX IF NOT EXISTS idx_algorithm_runs_store_id ON algorithm_runs(store_id);

-- Add composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_algorithm_runs_store_timestamp ON algorithm_runs(store_id, timestamp DESC);

-- Add helpful comment
COMMENT ON COLUMN algorithm_runs.store_id IS 'Links algorithm run to specific store for per-store monitoring';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on new tables for production security
-- Users can only access their own data

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own record
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth.uid()::text = id::text);

-- Policy: Users can update their own record
CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid()::text = id::text);

-- Enable RLS on stores table
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own stores
CREATE POLICY stores_select_own ON stores
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Policy: Users can update their own stores
CREATE POLICY stores_update_own ON stores
  FOR UPDATE
  USING (auth.uid()::text = user_id::text);

-- Policy: Users can insert their own stores
CREATE POLICY stores_insert_own ON stores
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

-- Policy: Users can delete their own stores
CREATE POLICY stores_delete_own ON stores
  FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Update RLS policies for existing tables to include store_id filtering
-- This ensures users can only access products from their own stores

-- Enable RLS on products (was disabled in initial migration)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read products from their stores
CREATE POLICY products_select_own_store ON products
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id::text = auth.uid()::text
    )
  );

-- Policy: Users can update products from their stores
CREATE POLICY products_update_own_store ON products
  FOR UPDATE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id::text = auth.uid()::text
    )
  );

-- Policy: Users can insert products to their stores
CREATE POLICY products_insert_own_store ON products
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE user_id::text = auth.uid()::text
    )
  );

-- Policy: Users can delete products from their stores
CREATE POLICY products_delete_own_store ON products
  FOR DELETE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id::text = auth.uid()::text
    )
  );

-- Enable RLS on other tables
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE algorithm_runs ENABLE ROW LEVEL SECURITY;

-- Policies for pricing_config (inherits from products)
CREATE POLICY pricing_config_select_own_store ON pricing_config
  FOR SELECT
  USING (
    product_id IN (
      SELECT id FROM products WHERE store_id IN (
        SELECT id FROM stores WHERE user_id::text = auth.uid()::text
      )
    )
  );

CREATE POLICY pricing_config_update_own_store ON pricing_config
  FOR UPDATE
  USING (
    product_id IN (
      SELECT id FROM products WHERE store_id IN (
        SELECT id FROM stores WHERE user_id::text = auth.uid()::text
      )
    )
  );

-- Policies for pricing_history
CREATE POLICY pricing_history_select_own_store ON pricing_history
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id::text = auth.uid()::text
    )
  );

CREATE POLICY pricing_history_insert_own_store ON pricing_history
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE user_id::text = auth.uid()::text
    )
  );

-- Policies for sales_data
CREATE POLICY sales_data_select_own_store ON sales_data
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id::text = auth.uid()::text
    )
  );

CREATE POLICY sales_data_insert_own_store ON sales_data
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE user_id::text = auth.uid()::text
    )
  );

CREATE POLICY sales_data_update_own_store ON sales_data
  FOR UPDATE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id::text = auth.uid()::text
    )
  );

-- Policies for algorithm_runs
CREATE POLICY algorithm_runs_select_own_store ON algorithm_runs
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id::text = auth.uid()::text
    )
  );

CREATE POLICY algorithm_runs_insert_own_store ON algorithm_runs
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE user_id::text = auth.uid()::text
    )
  );

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 
-- IMPORTANT: After running this migration, you need to:
-- 
-- 1. Backfill existing products with store_id:
--    - Create a default user and store for existing data
--    - Update all products to reference this store
--    - See backfill script: 008_backfill_store_data.sql
-- 
-- 2. Update application code to:
--    - Filter all queries by store_id
--    - Include store_id when inserting new records
--    - Handle multi-store switching in UI
-- 
-- 3. Security considerations:
--    - RLS is now ENABLED for production security
--    - Access tokens should be encrypted at rest
--    - Consider using Supabase Vault for token storage
-- 
-- 4. Performance considerations:
--    - All queries should use store_id in WHERE clauses
--    - Indexes are optimized for store-scoped queries
--    - Consider partitioning large tables by store_id if needed
-- 
-- ============================================================================


