-- Fix products table - Add missing Shopify columns and product_variants table
-- Run this in Supabase SQL Editor

-- 1. Add missing columns to products table
DO $$ 
BEGIN
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

-- 2. Create product_variants table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    shopify_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    compare_at_price DECIMAL(10, 2),
    sku TEXT,
    inventory_quantity INTEGER DEFAULT 0,
    weight DECIMAL(10, 2),
    weight_unit TEXT DEFAULT 'kg',
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for product_variants
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_shopify_id ON public.product_variants(shopify_id);

-- 4. Add indexes for new products columns
CREATE INDEX IF NOT EXISTS idx_products_handle ON public.products(handle);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

-- 5. Add updated_at trigger for product_variants (drop first if exists)
DROP TRIGGER IF EXISTS update_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER update_product_variants_updated_at 
    BEFORE UPDATE ON public.product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Enable RLS on product_variants
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for product_variants
DO $$ 
BEGIN
    -- Users can view product variants for their stores
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variants' AND policyname = 'Users can view product variants') THEN
        CREATE POLICY "Users can view product variants" ON public.product_variants
            FOR SELECT USING (
                product_id IN (
                    SELECT p.id FROM public.products p
                    JOIN public.stores s ON p.store_id = s.id
                    JOIN public.users u ON s.user_id = u.id
                    WHERE u.auth_user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- 8. Grant permissions
GRANT ALL ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
