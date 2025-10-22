import { describe, it, expect, beforeEach } from 'vitest';
import { validateEnvironment } from '../validateEnv';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('should pass validation with all required variables', () => {
    process.env.SHOPIFY_API_KEY = 'test_key';
    process.env.SHOPIFY_API_SECRET = 'test_secret';
    process.env.SHOPIFY_WEBHOOK_SECRET = 'test_webhook_secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
    process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION = '2024-10';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
    process.env.ENCRYPTION_KEY = 'test_encryption_key_32_chars_long';

    expect(() => validateEnvironment()).not.toThrow();
  });

  it('should fail validation with missing variables', () => {
    delete process.env.SHOPIFY_API_KEY;
    process.env.SHOPIFY_API_SECRET = 'test_secret';
    process.env.SHOPIFY_WEBHOOK_SECRET = 'test_webhook_secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
    process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION = '2024-10';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
    process.env.ENCRYPTION_KEY = 'test_encryption_key_32_chars_long';

    expect(() => validateEnvironment()).toThrow('Environment validation failed');
  });

  it('should fail validation with invalid URL', () => {
    process.env.SHOPIFY_API_KEY = 'test_key';
    process.env.SHOPIFY_API_SECRET = 'test_secret';
    process.env.SHOPIFY_WEBHOOK_SECRET = 'test_webhook_secret';
    process.env.NEXT_PUBLIC_APP_URL = 'invalid-url';
    process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION = '2024-10';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
    process.env.ENCRYPTION_KEY = 'test_encryption_key_32_chars_long';

    expect(() => validateEnvironment()).toThrow('Environment validation failed');
  });

  it('should fail validation with invalid API version format', () => {
    process.env.SHOPIFY_API_KEY = 'test_key';
    process.env.SHOPIFY_API_SECRET = 'test_secret';
    process.env.SHOPIFY_WEBHOOK_SECRET = 'test_webhook_secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
    process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION = 'invalid-format';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
    process.env.ENCRYPTION_KEY = 'test_encryption_key_32_chars_long';

    expect(() => validateEnvironment()).toThrow('Environment validation failed');
  });

  it('should fail validation with short encryption key', () => {
    process.env.SHOPIFY_API_KEY = 'test_key';
    process.env.SHOPIFY_API_SECRET = 'test_secret';
    process.env.SHOPIFY_WEBHOOK_SECRET = 'test_webhook_secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
    process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION = '2024-10';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
    process.env.ENCRYPTION_KEY = 'short';

    expect(() => validateEnvironment()).toThrow('Environment validation failed');
  });
});
