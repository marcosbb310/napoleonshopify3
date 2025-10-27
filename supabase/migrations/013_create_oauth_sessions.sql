-- Create oauth_sessions table for OAuth flow management
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
    completed_at TIMESTAMPTZ,
    
    -- Indexes for performance
    CONSTRAINT oauth_sessions_status_check CHECK (status IN ('pending', 'completed', 'failed', 'expired'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON public.oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_id ON public.oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_status ON public.oauth_sessions(status);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON public.oauth_sessions(expires_at);

-- Create function to cleanup expired sessions
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

-- Enable RLS
ALTER TABLE public.oauth_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own oauth sessions" ON public.oauth_sessions
    FOR SELECT USING (user_id = auth.uid()::text::uuid);

CREATE POLICY "Users can create their own oauth sessions" ON public.oauth_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid()::text::uuid);

CREATE POLICY "Users can update their own oauth sessions" ON public.oauth_sessions
    FOR UPDATE USING (user_id = auth.uid()::text::uuid);

-- Grant permissions
GRANT ALL ON public.oauth_sessions TO authenticated;
GRANT ALL ON public.oauth_sessions TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_oauth_sessions() TO service_role;
