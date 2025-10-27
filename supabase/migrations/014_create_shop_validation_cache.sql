-- Create shop_validation_cache table for caching shop domain validation results
CREATE TABLE IF NOT EXISTS public.shop_validation_cache (
    shop_domain TEXT PRIMARY KEY,
    is_valid BOOLEAN NOT NULL,
    validation_data JSONB,
    validated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shop_validation_cache_expires_at ON public.shop_validation_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_shop_validation_cache_is_valid ON public.shop_validation_cache(is_valid);

-- Enable RLS
ALTER TABLE public.shop_validation_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all authenticated users to read/write cache)
CREATE POLICY "Anyone can read shop validation cache" ON public.shop_validation_cache
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert shop validation cache" ON public.shop_validation_cache
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update shop validation cache" ON public.shop_validation_cache
    FOR UPDATE USING (true);

-- Grant permissions
GRANT ALL ON public.shop_validation_cache TO authenticated;
GRANT ALL ON public.shop_validation_cache TO service_role;
