import crypto from 'crypto';

/**
 * PKCE (Proof Key for Code Exchange) Implementation
 * Adds security layer to OAuth 2.0 flow
 * 
 * Flow:
 * 1. Generate random code_verifier (128 chars)
 * 2. Create code_challenge = SHA256(code_verifier)
 * 3. Send code_challenge to OAuth provider
 * 4. Provider stores challenge
 * 5. On callback, send code_verifier
 * 6. Provider verifies SHA256(code_verifier) === stored challenge
 */

export interface PKCEPair {
  codeVerifier: string; // 128 character random string (base64url)
  codeChallenge: string; // SHA256 hash of verifier (base64url)
}

/**
 * Generate a PKCE code verifier and challenge pair
 * 
 * @returns PKCEPair with verifier and challenge
 * 
 * @example
 * const { codeVerifier, codeChallenge } = generatePKCEPair();
 * // Store codeVerifier securely
 * // Send codeChallenge in OAuth request
 */
export function generatePKCEPair(): PKCEPair {
  // Generate 128 character random string (base64url encoded)
  const codeVerifier = generateRandomString(128);
  
  // Create SHA256 hash of verifier (base64url encoded)
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}

/**
 * Verify that a code verifier matches a code challenge
 * Uses timing-safe comparison to prevent timing attacks
 * 
 * @param codeVerifier - The original code verifier
 * @param codeChallenge - The code challenge to verify against
 * @returns true if verifier matches challenge
 * 
 * @example
 * const isValid = verifyPKCE(storedVerifier, receivedChallenge);
 * if (!isValid) throw new Error('PKCE verification failed');
 */
export function verifyPKCE(
  codeVerifier: string, 
  codeChallenge: string
): boolean {
  // Recreate challenge from verifier
  const expectedChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  // Timing-safe comparison (prevents timing attacks)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedChallenge),
      Buffer.from(codeChallenge)
    );
  } catch {
    // timingSafeEqual throws if lengths don't match
    return false;
  }
}

/**
 * Generate a cryptographically secure random string
 * Uses URL-safe base64 encoding (base64url)
 * 
 * @param length - Desired length of the string
 * @returns Random string of specified length
 * 
 * @internal
 */
function generateRandomString(length: number): string {
  // Calculate bytes needed (base64url is ~1.33x longer than bytes)
  const bytesNeeded = Math.ceil(length * 0.75);
  
  // Generate random bytes
  const randomBytes = crypto.randomBytes(bytesNeeded);
  
  // Convert to base64url and trim to exact length
  return randomBytes
    .toString('base64url')
    .slice(0, length);
}

/**
 * Generate a secure state parameter for CSRF protection
 * 
 * @returns UUID v4 string
 * 
 * @example
 * const state = generateSecureState();
 * // Store state in session
 * // Verify state matches on callback
 */
export function generateSecureState(): string {
  return crypto.randomUUID();
}
