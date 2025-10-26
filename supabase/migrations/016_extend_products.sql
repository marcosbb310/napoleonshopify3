-- Add analytics columns to products table
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS last_analytics_update TIMESTAMPTZ;

-- Add store_id to sales_data if not exists (CRITICAL FIX)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_data' AND column_name = 'store_id'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX idx_sales_data_store ON sales_data(store_id);
  END IF;
END $$;

-- Add store_id to algorithm_runs if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'algorithm_runs' AND column_name = 'store_id'
  ) THEN
    ALTER TABLE algorithm_runs ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX idx_algorithm_runs_store ON algorithm_runs(store_id);
  END IF;
END $$;

-- Update products unique constraint to include store_id
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_shopify_id_key;
ALTER TABLE products ADD CONSTRAINT products_store_shopify_unique UNIQUE (store_id, shopify_id);

-- Update sales_data unique constraint
ALTER TABLE sales_data DROP CONSTRAINT IF EXISTS sales_data_product_id_date_key;
ALTER TABLE sales_data ADD CONSTRAINT sales_data_unique UNIQUE (store_id, product_id, date);
