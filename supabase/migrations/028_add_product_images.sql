-- Migration: Add images column to products table
-- This stores product-level images from Shopify as JSONB

-- Step 1: Add images column as JSONB
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Step 2: Add index for JSONB queries (optional but helpful for filtering)
CREATE INDEX IF NOT EXISTS idx_products_images ON products USING GIN (images);

-- Step 3: Add comment for documentation
COMMENT ON COLUMN products.images IS 'Array of product images from Shopify, stored as JSONB. Format: [{"id": "string", "src": "url", "alt": "string", "width": number, "height": number}]';

-- Step 4: Verify column was added
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
      AND column_name = 'images'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE '✅ images column added successfully to products table';
  ELSE
    RAISE WARNING '⚠️ Failed to add images column to products table';
  END IF;
END $$;

