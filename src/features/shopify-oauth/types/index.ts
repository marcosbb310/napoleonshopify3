// ============================================================================
// PKCE Types
// ============================================================================

export interface PKCEPair {
  codeVerifier: string; // 128 character random string (base64url)
  codeChallenge: string; // SHA256 hash of verifier (base64url)
}

// ============================================================================
// OAuth Session Types
// ============================================================================

export type OAuthSessionStatus = 'pending' | 'completed' | 'failed' | 'expired';

export interface OAuthSession {
  id: string;
  userId: string;
  shopDomain: string;
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  status: OAuthSessionStatus;
  errorMessage?: string;
  createdAt: Date;
  expiresAt: Date;
  completedAt?: Date;
}

export interface CreateOAuthSessionParams {
  userId: string;
  shopDomain: string;
  pkce: PKCEPair;
}

export interface OAuthSessionRow {
  id: string;
  user_id: string;
  shop_domain: string;
  code_verifier: string;
  code_challenge: string;
  state: string;
  status: OAuthSessionStatus;
  error_message: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
}

// ============================================================================
// Shop Validation Types
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  shopDomain: string; // Normalized domain (with .myshopify.com)
  error?: string;
  errorCode?: ValidationErrorCode;
  suggestion?: string; // User-friendly suggestion
}

export type ValidationErrorCode =
  | 'INVALID_FORMAT'
  | 'DOMAIN_NOT_FOUND'
  | 'DNS_LOOKUP_FAILED'
  | 'NOT_SHOPIFY_STORE'
  | 'NETWORK_ERROR';

export interface ShopValidationCache {
  shopDomain: string;
  isValid: boolean;
  validationData?: {
    error?: string;
    errorCode?: ValidationErrorCode;
    suggestion?: string;
  };
  validatedAt: Date;
  expiresAt: Date;
}

export interface ShopValidationCacheRow {
  shop_domain: string;
  is_valid: boolean;
  validation_data: Record<string, unknown> | null;
  validated_at: string;
  expires_at: string;
}

// ============================================================================
// Token Types
// ============================================================================

export interface TokenSet {
  accessToken: string;
  scope: string;
  expiresAt?: Date;
}

export interface EncryptedTokens {
  accessTokenEncrypted: Buffer;
  scope: string;
}

export interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
  expires_in?: number;
}

// ============================================================================
// OAuth Flow Types
// ============================================================================

export interface OAuthInitiateRequest {
  shopDomain: string;
}

export interface OAuthInitiateResponse {
  success: boolean;
  oauthUrl?: string;
  sessionId?: string;
  error?: string;
  errorCode?: OAuthErrorCode;
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
  shop: string;
  hmac: string;
  timestamp?: string;
  host?: string;
}

export interface OAuthCallbackResult {
  success: boolean;
  storeId?: string;
  shopDomain?: string;
  error?: string;
  errorCode?: OAuthErrorCode;
}

// ============================================================================
// Error Types
// ============================================================================

export type OAuthErrorCode =
  | 'INVALID_SHOP_DOMAIN'
  | 'SHOP_NOT_FOUND'
  | 'USER_NOT_AUTHENTICATED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'PKCE_VERIFICATION_FAILED'
  | 'HMAC_VERIFICATION_FAILED'
  | 'TOKEN_EXCHANGE_FAILED'
  | 'STORE_CREATION_FAILED'
  | 'WEBHOOK_REGISTRATION_FAILED'
  | 'ENCRYPTION_FAILED'
  | 'ACCESS_DENIED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface OAuthError extends Error {
  code: OAuthErrorCode;
  technicalMessage?: string;
  suggestion?: string;
  retryable: boolean;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestion?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface StoreConnectionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (storeId: string) => void;
}

export interface ShopDomainInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidation?: (result: ValidationResult) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export interface PermissionPreviewProps {
  shopDomain: string;
  scopes: string[];
}

export type OAuthProgressStatus = 
  | 'validating' 
  | 'redirecting' 
  | 'authorizing' 
  | 'connecting' 
  | 'syncing' 
  | 'success' 
  | 'error';

export interface OAuthProgressProps {
  step: number;
  totalSteps: number;
  status: OAuthProgressStatus;
  message?: string;
  error?: string;
}

export interface ConnectionSuccessProps {
  store: {
    id: string;
    shopDomain: string;
    installedAt: Date;
  };
  onContinue: () => void;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookRegistration {
  id: string;
  storeId: string;
  webhookId: string;
  topic: string;
  address: string;
  registeredAt: Date;
  lastTriggeredAt?: Date;
  triggerCount: number;
  isActive: boolean;
}

export interface WebhookRegistrationRow {
  id: string;
  store_id: string;
  webhook_id: string;
  topic: string;
  address: string;
  registered_at: string;
  last_triggered_at: string | null;
  trigger_count: number;
  is_active: boolean;
}

// ============================================================================
// Sync Status Types
// ============================================================================

export type SyncStatus = 'in_progress' | 'completed' | 'failed';

export interface StoreSyncStatus {
  id: string;
  storeId: string;
  status: SyncStatus;
  productsSynced: number;
  totalProducts: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface StoreSyncStatusRow {
  id: string;
  store_id: string;
  status: SyncStatus;
  products_synced: number;
  total_products: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

// ============================================================================
// Service Types
// ============================================================================

export interface OAuthSessionService {
  createSession(params: CreateOAuthSessionParams): Promise<OAuthSession>;
  validateSession(state: string): Promise<OAuthSession | null>;
  completeSession(sessionId: string, success: boolean, error?: string): Promise<void>;
  cleanupExpiredSessions(): Promise<number>;
}

export interface TokenService {
  encryptAndStoreTokens(
    userId: string,
    shopDomain: string,
    tokens: TokenSet
  ): Promise<string>; // Returns store ID
  getDecryptedTokens(storeId: string): Promise<TokenSet>;
}

export interface ShopValidationService {
  validateShopDomain(domain: string): Promise<ValidationResult>;
  getCachedValidation(domain: string): Promise<ValidationResult | null>;
  cacheValidation(domain: string, result: ValidationResult): Promise<void>;
}
