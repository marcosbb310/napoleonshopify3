-- Simple migration to create only missing tables
-- Run this in Supabase SQL Editor

-- 1. Create oauth_sessions table (if it doesn't exist)
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

-- 2. Create shop_validation_cache table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.shop_validation_cache (
    shop_domain TEXT PRIMARY KEY,
    is_valid BOOLEAN NOT NULL,
    validation_data JSONB,
    validated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- 3. Create indexes (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON public.oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_id ON public.oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_status ON public.oauth_sessions(status);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON public.oauth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_shop_validation_cache_expires_at ON public.shop_validation_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_shop_validation_cache_is_valid ON public.shop_validation_cache(is_valid);

-- 4. Enable RLS (if not already enabled)
ALTER TABLE public.oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_validation_cache ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies (only if they don't exist)
DO $$ 
BEGIN
    -- oauth_sessions policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'oauth_sessions' AND policyname = 'Users can view their own oauth sessions') THEN
        CREATE POLICY "Users can view their own oauth sessions" ON public.oauth_sessions
            FOR SELECT USING (user_id = auth.uid()::text::uuid);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'oauth_sessions' AND policyname = 'Users can create their own oauth sessions') THEN
        CREATE POLICY "Users can create their own oauth sessions" ON public.oauth_sessions
            FOR INSERT WITH CHECK (user_id = auth.uid()::text::uuid);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'oauth_sessions' AND policyname = 'Users can update their own oauth sessions') THEN
        CREATE POLICY "Users can update their own oauth sessions" ON public.oauth_sessions
            FOR UPDATE USING (user_id = auth.uid()::text::uuid);
    END IF;
    
    -- shop_validation_cache policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shop_validation_cache' AND policyname = 'Anyone can read shop validation cache') THEN
        CREATE POLICY "Anyone can read shop validation cache" ON public.shop_validation_cache
            FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shop_validation_cache' AND policyname = 'Anyone can insert shop validation cache') THEN
        CREATE POLICY "Anyone can insert shop validation cache" ON public.shop_validation_cache
            FOR INSERT WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shop_validation_cache' AND policyname = 'Anyone can update shop validation cache') THEN
        CREATE POLICY "Anyone can update shop validation cache" ON public.shop_validation_cache
            FOR UPDATE USING (true);
    END IF;
END $$;

-- 6. Grant permissions
GRANT ALL ON public.oauth_sessions TO authenticated;
GRANT ALL ON public.oauth_sessions TO service_role;
GRANT ALL ON public.shop_validation_cache TO authenticated;
GRANT ALL ON public.shop_validation_cache TO service_role;

-- 7. Create cleanup function (if it doesn't exist)
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

-- 1. Create sync_status table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sync_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
    products_synced INTEGER DEFAULT 0,
    total_products INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    sync_type TEXT DEFAULT 'products' -- Add this column for filtering
);

-- 2. Add sync_type column if table exists but column doesn't
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'sync_status'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'sync_status' 
            AND column_name = 'sync_type'
        ) THEN
            ALTER TABLE public.sync_status ADD COLUMN sync_type TEXT DEFAULT 'products';
        END IF;
    END IF;
END $$;

-- 3. Update the unique constraint to include sync_type
DO $$ 
BEGIN
    -- Only if table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'sync_status'
    ) THEN
        -- Drop the old constraint if it exists
        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'sync_status_store_id_key' 
            AND conrelid = 'public.sync_status'::regclass
        ) THEN
            ALTER TABLE public.sync_status DROP CONSTRAINT sync_status_store_id_key;
        END IF;
        
        -- Add the new constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'sync_status_store_id_sync_type_key'
        ) THEN
            ALTER TABLE public.sync_status ADD CONSTRAINT sync_status_store_id_sync_type_key 
            UNIQUE (store_id, sync_type);
        END IF;
    END IF;
END $$;

-- 4. Create indexes for sync_status
CREATE INDEX IF NOT EXISTS idx_sync_status_store_id ON public.sync_status(store_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_sync_type ON public.sync_status(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_status_status ON public.sync_status(status);

-- 5. Enable RLS for sync_status
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for sync_status
DO $$ 
BEGIN
    -- Users can view sync status for their stores
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_status' AND policyname = 'Users can view sync status for their stores') THEN
        CREATE POLICY "Users can view sync status for their stores" ON public.sync_status
            FOR SELECT USING (
                store_id IN (
                    SELECT s.id FROM public.stores s 
                    JOIN public.users u ON s.user_id = u.id 
                    WHERE u.auth_user_id = auth.uid()
                )
            );
    END IF;
    
    -- System can manage sync status
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_status' AND policyname = 'System can manage sync status') THEN
        CREATE POLICY "System can manage sync status" ON public.sync_status
            FOR ALL USING (true);
    END IF;
END $$;

-- 7. Grant permissions for sync_status
GRANT ALL ON public.sync_status TO authenticated;
GRANT ALL ON public.sync_status TO service_role;
