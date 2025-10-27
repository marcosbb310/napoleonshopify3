-- Copy and paste this SQL into your Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/wmqrvvuxioukuwvvtmpe/sql

-- 1. Create oauth_sessions table
CREATE TABLE IF NOT EXISTS public.oauth_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shop_domain TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    state TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ
);

-- 2. Create shop_validation_cache table
CREATE TABLE IF NOT EXISTS public.shop_validation_cache (
    shop_domain TEXT PRIMARY KEY,
    is_valid BOOLEAN NOT NULL,
    validation_data JSONB,
    validated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON public.oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_id ON public.oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_status ON public.oauth_sessions(status);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON public.oauth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_shop_validation_cache_expires_at ON public.shop_validation_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_shop_validation_cache_is_valid ON public.shop_validation_cache(is_valid);

-- 4. Enable RLS
ALTER TABLE public.oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_validation_cache ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for oauth_sessions
CREATE POLICY "Users can view their own oauth sessions" ON public.oauth_sessions
    FOR SELECT USING (user_id = auth.uid()::text::uuid);

CREATE POLICY "Users can create their own oauth sessions" ON public.oauth_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid()::text::uuid);

CREATE POLICY "Users can update their own oauth sessions" ON public.oauth_sessions
    FOR UPDATE USING (user_id = auth.uid()::text::uuid);

-- 6. Create RLS policies for shop_validation_cache (allow all authenticated users)
CREATE POLICY "Anyone can read shop validation cache" ON public.shop_validation_cache
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert shop validation cache" ON public.shop_validation_cache
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update shop validation cache" ON public.shop_validation_cache
    FOR UPDATE USING (true);

-- 7. Grant permissions
GRANT ALL ON public.oauth_sessions TO authenticated;
GRANT ALL ON public.oauth_sessions TO service_role;
GRANT ALL ON public.shop_validation_cache TO authenticated;
GRANT ALL ON public.shop_validation_cache TO service_role;

-- 8. Create cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Mark expired sessions as 'expired'
    UPDATE public.oauth_sessions
    SET status = 'expired'
    WHERE status = 'pending' 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Delete very old sessions (older than 24 hours)
    DELETE FROM public.oauth_sessions
    WHERE created_at < NOW() - INTERVAL '24 hours';
    
    RETURN expired_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_oauth_sessions() TO service_role;
