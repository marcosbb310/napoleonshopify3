import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env.SHOPIFY_API_KEY = 'test_key';
process.env.SHOPIFY_API_SECRET = 'test_secret';
process.env.SHOPIFY_WEBHOOK_SECRET = 'test_webhook_secret';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION = '2024-10';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
process.env.ENCRYPTION_KEY = 'test_encryption_key_32_chars_long';

// Mock crypto for tests
Object.defineProperty(global, 'crypto', {
  value: {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mocked-hash'),
    })),
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mocked-digest'),
    })),
  },
});
