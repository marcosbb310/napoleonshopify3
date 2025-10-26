/**
 * Encryption utilities for handling Shopify access tokens
 * Provides consistent encryption key handling across the application
 */

/**
 * Get the decoded encryption key from environment variables
 * The key is stored as base64-encoded in the environment but needs to be decoded
 * to a 32-character binary string for encryption operations
 * 
 * @returns The decoded 32-character encryption key
 * @throws Error if the key is missing or invalid
 */
export function getEncryptionKey(): string {
  const ENCRYPTION_KEY_BASE64 = process.env.ENCRYPTION_KEY;

  if (!ENCRYPTION_KEY_BASE64) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  try {
    const decodedKey = Buffer.from(ENCRYPTION_KEY_BASE64, 'base64').toString('binary');
    if (decodedKey.length !== 32) {
      throw new Error('Decoded ENCRYPTION_KEY must be exactly 32 characters');
    }
    return decodedKey;
  } catch (error) {
    throw new Error('ENCRYPTION_KEY must be a valid base64-encoded 32-character string');
  }
}
