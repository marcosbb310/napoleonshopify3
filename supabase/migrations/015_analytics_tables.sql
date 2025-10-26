-- Product analytics aggregated metrics
CREATE TABLE IF NOT EXISTS product_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  performance_score DECIMAL(5,2) DEFAULT 0,
  revenue_trend VARCHAR(20) CHECK (revenue_trend IN ('increasing', 'stable', 'decreasing')),
  profit_margin DECIMAL(5,2),
  avg_conversion_rate DECIMAL(5,2),
  total_revenue_30d DECIMAL(10,2) DEFAULT 0,
  total_units_30d INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id)
);

-- Price change impact tracking
CREATE TABLE IF NOT EXISTS price_change_impact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  price_change_id UUID REFERENCES pricing_history(id) ON DELETE CASCADE,
  days_after_change INTEGER NOT NULL,
  revenue_before DECIMAL(10,2),
  revenue_after DECIMAL(10,2),
  units_before INTEGER,
  units_after INTEGER,
  conversion_before DECIMAL(5,2),
  conversion_after DECIMAL(5,2),
  impact_score DECIMAL(5,2),
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  topic VARCHAR(100) NOT NULL,
  shopify_webhook_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processing_started_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Error logs for debugging
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_product_analytics_store ON product_analytics(store_id);
CREATE INDEX idx_product_analytics_score ON product_analytics(performance_score DESC);
CREATE INDEX idx_price_impact_product ON price_change_impact(product_id);
CREATE INDEX idx_price_impact_change ON price_change_impact(price_change_id);
CREATE INDEX idx_webhook_logs_store ON webhook_logs(store_id);
CREATE INDEX idx_webhook_logs_processed ON webhook_logs(processed, received_at);
CREATE INDEX idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_severity ON error_logs(severity, resolved);

-- RLS Policies
ALTER TABLE product_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_change_impact ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own store analytics
CREATE POLICY "Users can read own product analytics" ON product_analytics
  FOR SELECT USING (
    store_id IN (SELECT id FROM stores WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  );

CREATE POLICY "Users can read own price impact" ON price_change_impact
  FOR SELECT USING (
    product_id IN (
      SELECT p.id FROM products p 
      JOIN stores s ON p.store_id = s.id 
      WHERE s.user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can read own webhook logs" ON webhook_logs
  FOR SELECT USING (
    store_id IN (SELECT id FROM stores WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  );

CREATE POLICY "Users can read own error logs" ON error_logs
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Service role can do everything
GRANT ALL ON product_analytics TO service_role;
GRANT ALL ON price_change_impact TO service_role;
GRANT ALL ON webhook_logs TO service_role;
GRANT ALL ON error_logs TO service_role;
