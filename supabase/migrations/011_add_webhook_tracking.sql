-- Table to track processed webhooks for idempotency
CREATE TABLE processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload_hash TEXT, -- For duplicate detection
  UNIQUE(webhook_id, store_id)
);

-- Table to track sync status
CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  products_synced INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(store_id) -- One sync per store at a time
);

-- Indexes for performance
CREATE INDEX idx_processed_webhooks_store_id ON processed_webhooks(store_id);
CREATE INDEX idx_processed_webhooks_processed_at ON processed_webhooks(processed_at DESC);
CREATE INDEX idx_sync_status_store_id ON sync_status(store_id);

-- Enable RLS
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for processed_webhooks
CREATE POLICY "Users can view processed webhooks for their stores" ON processed_webhooks
  FOR SELECT USING (
    store_id IN (
      SELECT s.id FROM stores s 
      JOIN users u ON s.user_id = u.id 
      WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert processed webhooks" ON processed_webhooks
  FOR INSERT WITH CHECK (true);

-- RLS policies for sync_status
CREATE POLICY "Users can view sync status for their stores" ON sync_status
  FOR SELECT USING (
    store_id IN (
      SELECT s.id FROM stores s 
      JOIN users u ON s.user_id = u.id 
      WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage sync status" ON sync_status
  FOR ALL USING (true);
