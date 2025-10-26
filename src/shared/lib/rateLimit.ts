import { createAdminClient } from './supabase';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const supabase = createAdminClient();
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  // Count recent requests
  const { count } = await supabase
    .from('error_logs')
    .select('*', { count: 'exact', head: true })
    .eq('context->>identifier', identifier)
    .gte('created_at', new Date(windowStart).toISOString());
  
  return (count || 0) < MAX_REQUESTS;
}
