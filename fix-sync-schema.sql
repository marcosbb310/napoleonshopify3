-- Fix Database Schema to Match Sync Code Expectations
-- Run this in Supabase SQL Editor to align tables with syncProducts.ts

-- 1. Add missing columns to products table
DO $$ 
BEGIN
    -- Add store_id column (required for multi-tenant)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'store_id'
    ) THEN
        ALTER TABLE public.products ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;
    END IF;

    -- Add handle column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'handle'
    ) THEN
        ALTER TABLE public.products ADD COLUMN handle TEXT;
    END IF;

    -- Add tags column (array)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'tags'
    ) THEN
        ALTER TABLE public.products ADD COLUMN tags TEXT[];
    END IF;

    -- Add status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.products ADD COLUMN status TEXT DEFAULT 'active';
    END IF;

    -- Add is_active column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.products ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;

    -- Add description column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE public.products ADD COLUMN description TEXT;
    END IF;
END $$;

-- 2. Create product_variants table if it doesn't exist (with all required columns)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    shopify_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    compare_at_price DECIMAL(10, 2),
    sku TEXT,
    inventory_quantity INTEGER DEFAULT 0,
    weight DECIMAL(10, 2),
    weight_unit TEXT DEFAULT 'kg',
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Ensure store_id exists on product_variants even if the table pre-existed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'product_variants' 
        AND column_name = 'store_id'
    ) THEN
        ALTER TABLE public.product_variants 
          ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Create sync_status table for tracking sync progress
CREATE TABLE IF NOT EXISTS public.sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL,
    total_products INTEGER DEFAULT 0,
    products_synced INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

-- 4. Drop old unique constraints that conflict with new composite ones
DO $$
BEGIN
    -- Drop old unique constraint on products.shopify_id if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_shopify_id_key'
    ) THEN
        ALTER TABLE public.products DROP CONSTRAINT products_shopify_id_key;
    END IF;

    -- Drop old unique constraint on product_variants.shopify_id if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'product_variants_shopify_id_key'
    ) THEN
        ALTER TABLE public.product_variants DROP CONSTRAINT product_variants_shopify_id_key;
    END IF;
END $$;

-- 5. Create new composite unique constraints to match sync code upsert logic
DO $$
BEGIN
    -- Products: unique on (store_id, shopify_id) for upsert conflict resolution
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'uq_products_store_shopify'
    ) THEN
        CREATE UNIQUE INDEX uq_products_store_shopify 
        ON public.products(store_id, shopify_id);
    END IF;

    -- Product variants: unique on (store_id, product_id, shopify_id) for upsert conflict resolution
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'uq_variants_store_product_shopify'
    ) THEN
        CREATE UNIQUE INDEX uq_variants_store_product_shopify 
        ON public.product_variants(store_id, product_id, shopify_id);
    END IF;

    -- Sync status: unique on (store_id, sync_type) to keep latest per type
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'uq_sync_status_store_type'
    ) THEN
        CREATE UNIQUE INDEX uq_sync_status_store_type 
        ON public.sync_status(store_id, sync_type);
    END IF;
END $$;

-- 6. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_handle ON public.products(handle);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

CREATE INDEX IF NOT EXISTS idx_product_variants_store_id ON public.product_variants(store_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_shopify_id ON public.product_variants(shopify_id);

CREATE INDEX IF NOT EXISTS idx_sync_status_store_id ON public.sync_status(store_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_type ON public.sync_status(sync_type);

-- 7. Add updated_at trigger for product_variants
DROP TRIGGER IF EXISTS update_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER update_product_variants_updated_at 
    BEFORE UPDATE ON public.product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Enable RLS on new tables (optional - admin client bypasses RLS anyway)
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for product_variants (users can view variants for their stores)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'product_variants' 
        AND policyname = 'Users can view product variants'
    ) THEN
        CREATE POLICY "Users can view product variants" ON public.product_variants
            FOR SELECT USING (
                store_id IN (
                    SELECT s.id FROM public.stores s
                    JOIN public.users u ON s.user_id = u.id
                    WHERE u.auth_user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- 10. Grant permissions
GRANT ALL ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
GRANT ALL ON public.sync_status TO authenticated;
GRANT ALL ON public.sync_status TO service_role;

-- 11. Add helpful comments
COMMENT ON COLUMN public.products.store_id IS 'Multi-tenant store identifier - required for sync operations';
COMMENT ON COLUMN public.products.handle IS 'Shopify product handle (URL slug)';
COMMENT ON COLUMN public.products.tags IS 'Array of product tags from Shopify';
COMMENT ON COLUMN public.products.status IS 'Product status: active, draft, archived';
COMMENT ON COLUMN public.products.is_active IS 'Internal active flag for soft deletes';

COMMENT ON COLUMN public.product_variants.store_id IS 'Multi-tenant store identifier - required for sync operations';
COMMENT ON COLUMN public.product_variants.product_id IS 'Reference to internal products.id (UUID)';
COMMENT ON COLUMN public.product_variants.shopify_id IS 'Shopify variant ID (string)';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Schema update completed successfully!';
    RAISE NOTICE 'Products table now has: store_id, handle, tags, status, is_active, description';
    RAISE NOTICE 'Product_variants table created with: store_id, product_id, shopify_id, and all variant fields';
    RAISE NOTICE 'Sync_status table created for tracking sync progress';
    RAISE NOTICE 'Unique constraints updated to match sync code upsert logic';
END $$;
