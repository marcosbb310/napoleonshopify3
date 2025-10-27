import type { OAuthError, OAuthErrorCode, UserFriendlyError } from '../types';

/**
 * Error message mapping
 */
export const ERROR_MESSAGES: Record<OAuthErrorCode, { title: string; message: string; suggestion?: string }> = {
  INVALID_SHOP_DOMAIN: {
    title: 'Invalid Store Domain',
    message: 'The store domain you entered is not valid.',
    suggestion: 'Please enter a valid Shopify domain (e.g., mystore.myshopify.com)',
  },
  SHOP_NOT_FOUND: {
    title: 'Store Not Found',
    message: 'We couldn\'t find a Shopify store with that domain.',
    suggestion: 'Please check the spelling and try again.',
  },
  USER_NOT_AUTHENTICATED: {
    title: 'Not Logged In',
    message: 'You must be logged in to connect a store.',
    suggestion: 'Please sign in and try again.',
  },
  SESSION_NOT_FOUND: {
    title: 'Session Expired',
    message: 'Your connection session has expired.',
    suggestion: 'Please start the connection process again.',
  },
  SESSION_EXPIRED: {
    title: 'Session Expired',
    message: 'Your connection session has expired.',
    suggestion: 'Please start the connection process again.',
  },
  PKCE_VERIFICATION_FAILED: {
    title: 'Security Verification Failed',
    message: 'The security verification failed.',
    suggestion: 'Please try connecting again.',
  },
  HMAC_VERIFICATION_FAILED: {
    title: 'Security Verification Failed',
    message: 'The security verification failed.',
    suggestion: 'Please try connecting again.',
  },
  TOKEN_EXCHANGE_FAILED: {
    title: 'Connection Failed',
    message: 'Failed to complete the connection with Shopify.',
    suggestion: 'Please try again. If the problem persists, contact support.',
  },
  STORE_CREATION_FAILED: {
    title: 'Failed to Save Store',
    message: 'We couldn\'t save your store connection.',
    suggestion: 'Please try again. If the problem persists, contact support.',
  },
  WEBHOOK_REGISTRATION_FAILED: {
    title: 'Webhook Registration Failed',
    message: 'Store connected but webhook registration failed.',
    suggestion: 'You can manually register webhooks in settings.',
  },
  ENCRYPTION_FAILED: {
    title: 'Encryption Failed',
    message: 'Failed to securely store your access token.',
    suggestion: 'Please try again. If the problem persists, contact support.',
  },
  ACCESS_DENIED: {
    title: 'Access Denied',
    message: 'You denied access to your Shopify store.',
    suggestion: 'To use Smart Pricing, you need to grant the requested permissions.',
  },
  NETWORK_ERROR: {
    title: 'Network Error',
    message: 'Unable to connect to the server.',
    suggestion: 'Please check your internet connection and try again.',
  },
  UNKNOWN_ERROR: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred.',
    suggestion: 'Please try again. If the problem persists, contact support.',
  },
};

/**
 * Convert OAuth error to user-friendly error
 */
export function handleOAuthError(error: Error | OAuthError): UserFriendlyError {
  const oauthError = error as OAuthError;
  const errorCode = oauthError.code || 'UNKNOWN_ERROR';
  
  const errorInfo = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN_ERROR;

  return {
    title: errorInfo.title,
    message: errorInfo.message,
    suggestion: errorInfo.suggestion,
  };
}

/**
 * Create OAuth error
 */
export function createOAuthError(
  code: OAuthErrorCode,
  message?: string,
  retryable: boolean = true
): OAuthError {
  const errorInfo = ERROR_MESSAGES[code];
  const error = new Error(message || errorInfo.message) as OAuthError;
  
  error.code = code;
  error.technicalMessage = message;
  error.suggestion = errorInfo.suggestion;
  error.retryable = retryable;
  
  return error;
}
