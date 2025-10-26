-- Fix sync_status table - Create table and add sync_type column
-- Run this in Supabase SQL Editor

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
    sync_type TEXT DEFAULT 'products'
);

-- 3. Add sync_type column if table exists but column doesn't (for existing tables)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sync_status'
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

-- 4. Update all existing rows to have sync_type = 'products' if null
UPDATE public.sync_status SET sync_type = 'products' WHERE sync_type IS NULL;

-- 5. Update the unique constraint
DO $$ 
BEGIN
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
END $$;

-- 6. Create index for sync_type if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_sync_status_sync_type ON public.sync_status(sync_type);

-- 7. Create index for status if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_sync_status_status ON public.sync_status(status);

-- 8. Enable RLS (if not already enabled)
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for sync_status
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

-- 10. Grant permissions
GRANT ALL ON public.sync_status TO authenticated;
GRANT ALL ON public.sync_status TO service_role;
