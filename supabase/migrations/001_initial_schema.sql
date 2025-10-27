-- Complete Smart Pricing Database Schema
-- This is the master schema file with all features
-- For fresh database setup, run this entire file in Supabase SQL Editor
-- Last updated: October 13, 2025 (period_hours implemented)

-- Create enum types
CREATE TYPE pricing_state AS ENUM ('increasing', 'waiting_after_revert', 'at_max_cap');
CREATE TYPE pricing_action AS ENUM ('increase', 'revert', 'manual_override');
CREATE TYPE sales_source AS ENUM ('shopify', 'mock');

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  vendor TEXT,
  product_type TEXT,
  starting_price DECIMAL(10, 2) NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pricing configuration per product
CREATE TABLE pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  auto_pricing_enabled BOOLEAN DEFAULT TRUE,
  increment_percentage DECIMAL(5, 2) DEFAULT 5.0,
  period_hours INTEGER DEFAULT 24,
  revenue_drop_threshold DECIMAL(5, 2) DEFAULT 1.0,
  wait_hours_after_revert INTEGER DEFAULT 24, -- 1 day in hours (matches period_hours)
  max_increase_percentage DECIMAL(5, 2) DEFAULT 100.0,
  current_state pricing_state DEFAULT 'increasing',
  last_price_change_date TIMESTAMPTZ,
  revert_wait_until_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id)
);

-- Pricing history log
CREATE TABLE pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  old_price DECIMAL(10, 2) NOT NULL,
  new_price DECIMAL(10, 2) NOT NULL,
  action pricing_action NOT NULL,
  reason TEXT NOT NULL,
  revenue_previous_period DECIMAL(10, 2),
  revenue_current_period DECIMAL(10, 2),
  revenue_change_percent DECIMAL(5, 2),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Sales data
CREATE TABLE sales_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price_on_date DECIMAL(10, 2) NOT NULL,
  units_sold INTEGER NOT NULL DEFAULT 0,
  revenue DECIMAL(10, 2) NOT NULL DEFAULT 0,
  source sales_source DEFAULT 'shopify',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, date)
);

-- Algorithm run logs
CREATE TABLE algorithm_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  products_processed INTEGER DEFAULT 0,
  products_increased INTEGER DEFAULT 0,
  products_reverted INTEGER DEFAULT 0,
  products_waiting INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  errors JSONB
);

-- Create indexes for performance
CREATE INDEX idx_products_shopify_id ON products(shopify_id);
CREATE INDEX idx_pricing_config_product_id ON pricing_config(product_id);
CREATE INDEX idx_pricing_history_product_id ON pricing_history(product_id);
CREATE INDEX idx_pricing_history_timestamp ON pricing_history(timestamp DESC);
CREATE INDEX idx_sales_data_product_date ON sales_data(product_id, date DESC);
CREATE INDEX idx_algorithm_runs_timestamp ON algorithm_runs(timestamp DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_config_updated_at BEFORE UPDATE ON pricing_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for MVP (enable before production)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE algorithm_runs DISABLE ROW LEVEL SECURITY;

-- Add helpful comments for documentation
COMMENT ON COLUMN pricing_config.period_hours IS 'Number of hours between price changes (default: 24 = 1 day). Can be set to 1 for fast testing.';
COMMENT ON COLUMN pricing_config.next_price_change_date IS 'Timestamp when the next price change should occur. Updated after each price change and manual overrides.';

