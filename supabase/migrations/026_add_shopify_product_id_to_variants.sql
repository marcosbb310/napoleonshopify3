-- Add shopify_product_id to product_variants table
-- This column stores the Shopify product ID that each variant belongs to
-- This is needed for querying variants by Shopify product ID directly

BEGIN;

-- Add shopify_product_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'product_variants' 
    AND column_name = 'shopify_product_id'
  ) THEN
    -- Add the column as nullable first (for existing data)
    ALTER TABLE public.product_variants 
    ADD COLUMN shopify_product_id TEXT;
    
    -- Backfill shopify_product_id from parent product's shopify_id
    -- This links each variant to its parent product's Shopify ID
    UPDATE public.product_variants pv
    SET shopify_product_id = p.shopify_id
    FROM public.products p
    WHERE pv.product_id = p.id
      AND pv.shopify_product_id IS NULL;
    
    -- Create index for performance (querying variants by Shopify product ID)
    CREATE INDEX IF NOT EXISTS idx_product_variants_shopify_product_id 
    ON public.product_variants(shopify_product_id);
    
    -- Create composite index for common query pattern (store + shopify_product_id)
    CREATE INDEX IF NOT EXISTS idx_product_variants_store_shopify_product 
    ON public.product_variants(store_id, shopify_product_id);
    
    -- Add comment for documentation
    COMMENT ON COLUMN public.product_variants.shopify_product_id IS 
    'Shopify product ID that this variant belongs to. Allows querying variants directly by Shopify product ID without joining through products table.';
    
    RAISE NOTICE 'Added shopify_product_id column to product_variants and backfilled from products';
  ELSE
    RAISE NOTICE 'Column shopify_product_id already exists in product_variants';
  END IF;
END $$;

COMMIT;

