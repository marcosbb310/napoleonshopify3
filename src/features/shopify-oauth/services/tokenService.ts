import { createAdminClient } from '@/shared/lib/supabase';
import { getEncryptionKey } from '@/shared/lib/encryption';
import type { TokenSet } from '../types';

/**
 * Token Encryption Service
 * Handles encryption and storage of Shopify access tokens
 * 
 * Uses PostgreSQL pgcrypto for encryption:
 * - Tokens are encrypted with AES-256
 * - Encryption key from environment variable
 * - Tokens never stored in plain text
 */

// Get the decoded encryption key (lazy loaded to avoid errors at module load time)
function getEncryptionKeyLazy(): string {
  try {
    return getEncryptionKey();
  } catch (error) {
    throw new Error(`Encryption key error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check ENCRYPTION_KEY environment variable.`);
  }
}

/**
 * Encrypt and store Shopify access tokens
 * 
 * @param userId - The user ID
 * @param shopDomain - The Shopify shop domain
 * @param tokens - The token set to encrypt and store
 * @returns The created or updated store ID
 * @throws Error if encryption or storage fails
 * 
 * @example
 * const storeId = await encryptAndStoreTokens(
 *   user.id,
 *   'mystore.myshopify.com',
 *   { accessToken: 'shpat_...', scope: 'read_products,write_products' }
 * );
 */
export async function encryptAndStoreTokens(
  userId: string,
  shopDomain: string,
  tokens: TokenSet
): Promise<string> {
  const supabase = createAdminClient();
  
  // Get encryption key (lazy loaded)
  const encryptionKey = getEncryptionKeyLazy();
  
  // Encrypt the access token using PostgreSQL function
  const { data: encryptedToken, error: encryptError } = await supabase.rpc(
    'encrypt_token',
    {
      token_text: tokens.accessToken,
      key: encryptionKey,
    }
  );
  
  if (encryptError || !encryptedToken) {
    throw new Error(`Failed to encrypt token: ${encryptError?.message}`);
  }
  
  // Check if store already exists for this user
  const { data: existingStore } = await supabase
    .from('stores')
    .select('id')
    .eq('shop_domain', shopDomain)
    .eq('user_id', userId)
    .single();
  
  if (existingStore) {
    // Update existing store
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        access_token: tokens.accessToken, // Keep for backward compatibility
        access_token_encrypted: encryptedToken,
        scope: tokens.scope,
        last_synced_at: new Date().toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingStore.id);
    
    if (updateError) {
      throw new Error(`Failed to update store: ${updateError.message}`);
    }
    
    return existingStore.id;
  } else {
    // Create new store
    const { data: newStore, error: insertError } = await supabase
      .from('stores')
      .insert({
        user_id: userId,
        shop_domain: shopDomain,
        access_token: tokens.accessToken, // Keep for backward compatibility
        access_token_encrypted: encryptedToken,
        scope: tokens.scope,
        installed_at: new Date().toISOString(),
        is_active: true,
      })
      .select('id')
      .single();
    
    if (insertError || !newStore) {
      throw new Error(`Failed to create store: ${insertError?.message}`);
    }
    
    return newStore.id;
  }
}

/**
 * Get decrypted access tokens for a store
 * 
 * @param storeId - The store ID
 * @returns Decrypted token set
 * @throws Error if store not found or decryption fails
 * 
 * @example
 * const tokens = await getDecryptedTokens(storeId);
 * // Use tokens.accessToken for Shopify API calls
 */
export async function getDecryptedTokens(storeId: string): Promise<TokenSet> {
  const supabase = createAdminClient();
  
  const { data: store, error: fetchError } = await supabase
    .from('stores')
    .select('access_token_encrypted, scope')
    .eq('id', storeId)
    .single();
  
  if (fetchError || !store) {
    throw new Error(`Store not found: ${fetchError?.message}`);
  }
  
  // Get encryption key (lazy loaded)
  const encryptionKey = getEncryptionKeyLazy();
  
  // Decrypt the access token using PostgreSQL function
  const { data: decryptedToken, error: decryptError } = await supabase.rpc(
    'decrypt_token',
    {
      encrypted_data: store.access_token_encrypted,
      key: encryptionKey,
    }
  );
  
  if (decryptError || !decryptedToken) {
    throw new Error(`Failed to decrypt token: ${decryptError?.message}`);
  }
  
  return {
    accessToken: decryptedToken,
    scope: store.scope,
  };
}
