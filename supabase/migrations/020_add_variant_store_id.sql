-- Add store_id to product_variants table
-- This migration ensures product_variants has store_id for multi-store support

BEGIN;

-- Add store_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'product_variants' 
    AND column_name = 'store_id'
  ) THEN
    ALTER TABLE public.product_variants ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;
    
    -- Backfill store_id from parent product
    UPDATE public.product_variants pv
    SET store_id = p.store_id
    FROM public.products p
    WHERE pv.product_id = p.id
      AND pv.store_id IS NULL;
    
    -- Make store_id NOT NULL after backfill
    ALTER TABLE public.product_variants ALTER COLUMN store_id SET NOT NULL;
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_product_variants_store_id ON public.product_variants(store_id);
    
    -- Add composite unique constraint for store_id + product_id + shopify_id
    ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_shopify_id_key;
    ALTER TABLE public.product_variants 
      ADD CONSTRAINT product_variants_store_product_shopify_unique 
      UNIQUE (store_id, product_id, shopify_id);
  END IF;
END $$;

COMMIT;

