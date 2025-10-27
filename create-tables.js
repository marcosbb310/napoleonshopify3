const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTables() {
  console.log('🔄 Creating oauth_sessions table...');
  
  // Create oauth_sessions table
  const oauthSessionsSQL = `
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
  `;
  
  const { error: oauthError } = await supabase.rpc('exec', { sql: oauthSessionsSQL });
  
  if (oauthError) {
    console.error('❌ Failed to create oauth_sessions table:', oauthError);
    return false;
  }
  
  console.log('✅ oauth_sessions table created');
  
  // Create shop_validation_cache table
  console.log('🔄 Creating shop_validation_cache table...');
  
  const validationCacheSQL = `
    CREATE TABLE IF NOT EXISTS public.shop_validation_cache (
        shop_domain TEXT PRIMARY KEY,
        is_valid BOOLEAN NOT NULL,
        validation_data JSONB,
        validated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
    );
  `;
  
  const { error: cacheError } = await supabase.rpc('exec', { sql: validationCacheSQL });
  
  if (cacheError) {
    console.error('❌ Failed to create shop_validation_cache table:', cacheError);
    return false;
  }
  
  console.log('✅ shop_validation_cache table created');
  
  // Create indexes
  console.log('🔄 Creating indexes...');
  
  const indexesSQL = `
    CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON public.oauth_sessions(state);
    CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_id ON public.oauth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_sessions_status ON public.oauth_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON public.oauth_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_shop_validation_cache_expires_at ON public.shop_validation_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_shop_validation_cache_is_valid ON public.shop_validation_cache(is_valid);
  `;
  
  const { error: indexError } = await supabase.rpc('exec', { sql: indexesSQL });
  
  if (indexError) {
    console.error('❌ Failed to create indexes:', indexError);
    return false;
  }
  
  console.log('✅ Indexes created');
  
  // Enable RLS
  console.log('🔄 Enabling RLS...');
  
  const rlsSQL = `
    ALTER TABLE public.oauth_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.shop_validation_cache ENABLE ROW LEVEL SECURITY;
  `;
  
  const { error: rlsError } = await supabase.rpc('exec', { sql: rlsSQL });
  
  if (rlsError) {
    console.error('❌ Failed to enable RLS:', rlsError);
    return false;
  }
  
  console.log('✅ RLS enabled');
  
  console.log('🎉 All tables created successfully!');
  return true;
}

createTables().catch(console.error);
