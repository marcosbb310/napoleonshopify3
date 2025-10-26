import { createAdminClient } from '@/shared/lib/supabase';
import { generateSecureState } from '@/shared/lib/pkce';
import type {
  OAuthSession,
  OAuthSessionRow,
  CreateOAuthSessionParams,
  PKCEPair,
} from '../types';

/**
 * OAuth Session Service
 * Manages OAuth sessions with PKCE verifiers
 * 
 * Responsibilities:
 * - Create new OAuth sessions
 * - Validate sessions on callback
 * - Mark sessions as completed/failed
 * - Cleanup expired sessions
 */

const SESSION_EXPIRY_MINUTES = 10;

/**
 * Create a new OAuth session
 * 
 * @param params - Session creation parameters
 * @returns Created OAuth session
 * @throws Error if session creation fails
 * 
 * @example
 * const session = await createSession({
 *   userId: user.id,
 *   shopDomain: 'mystore.myshopify.com',
 *   pkce: generatePKCEPair()
 * });
 */
export async function createSession(
  params: CreateOAuthSessionParams
): Promise<OAuthSession> {
  const supabase = createAdminClient();
  
  const state = generateSecureState();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MINUTES * 60 * 1000);
  
  const { data, error } = await supabase
    .from('oauth_sessions')
    .insert({
      user_id: params.userId,
      shop_domain: params.shopDomain,
      code_verifier: params.pkce.codeVerifier,
      code_challenge: params.pkce.codeChallenge,
      state,
      status: 'pending',
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to create OAuth session: ${error?.message}`);
  }
  
  return rowToSession(data as OAuthSessionRow);
}

/**
 * Validate an OAuth session by state parameter
 * 
 * @param state - The state parameter from OAuth callback
 * @returns OAuth session if valid, null if not found or expired
 * 
 * @example
 * const session = await validateSession(callbackParams.state);
 * if (!session) {
 *   throw new Error('Invalid or expired session');
 * }
 */
export async function validateSession(
  state: string
): Promise<OAuthSession | null> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('oauth_sessions')
    .select('*')
    .eq('state', state)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return rowToSession(data as OAuthSessionRow);
}

/**
 * Mark an OAuth session as completed or failed
 * 
 * @param sessionId - The session ID
 * @param success - Whether the OAuth flow succeeded
 * @param errorMessage - Optional error message if failed
 * 
 * @example
 * await completeSession(session.id, true);
 * // or
 * await completeSession(session.id, false, 'Token exchange failed');
 */
export async function completeSession(
  sessionId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const supabase = createAdminClient();
  
  const { error } = await supabase
    .from('oauth_sessions')
    .update({
      status: success ? 'completed' : 'failed',
      error_message: errorMessage || null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
  
  if (error) {
    console.error('Failed to complete OAuth session:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Cleanup expired OAuth sessions
 * Should be called periodically (e.g., via cron)
 * 
 * @returns Number of sessions marked as expired
 * 
 * @example
 * const expiredCount = await cleanupExpiredSessions();
 * console.log(`Marked ${expiredCount} sessions as expired`);
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase.rpc('cleanup_expired_oauth_sessions');
  
  if (error) {
    console.error('Failed to cleanup expired sessions:', error);
    return 0;
  }
  
  return data || 0;
}

/**
 * Convert database row to OAuthSession object
 * @internal
 */
function rowToSession(row: OAuthSessionRow): OAuthSession {
  return {
    id: row.id,
    userId: row.user_id,
    shopDomain: row.shop_domain,
    codeVerifier: row.code_verifier,
    codeChallenge: row.code_challenge,
    state: row.state,
    status: row.status,
    errorMessage: row.error_message || undefined,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}
