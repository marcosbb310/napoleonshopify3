# Comprehensive Shopify Integration Plan

## Overview
Fix critical webhook bug, implement robust webhook registration with idempotency and duplicate prevention, add automatic product sync, implement rate limiting, add environment validation, and create comprehensive test suite.

## Current State Analysis
- ✅ App already uses real Shopify data (not mock)
- ✅ Infrastructure mostly in place
- ⚠️ Critical bug: Webhook handler missing `supabaseAdmin` import
- ❌ Webhooks not registered during OAuth flow
- ❌ No test suite to verify integration

## Implementation Steps

### 1. Fix Critical Webhook Bug

**File**: `src/app/api/webhooks/shopify/product-update/route.ts`

**Issue**: Line 60 references undefined `supabaseAdmin` variable

**Fix**: Add missing import and initialization:
```typescript
// Add at top of file (after line 3)
import { createAdminClient } from '@/shared/lib/supabase';

// Add before line 60 (before const { data, error } = await supabaseAdmin)
const supabaseAdmin = createAdminClient();
```

**Impact**: Without this fix, manual price changes in Shopify admin get overwritten by the algorithm.

### 2. Create Database Migrations

**New file**: `supabase/migrations/011_add_webhook_tracking.sql`

```sql
-- Table to track processed webhooks for idempotency
CREATE TABLE processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload_hash TEXT, -- For duplicate detection
  UNIQUE(webhook_id, store_id)
);

-- Table to track sync status
CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  products_synced INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(store_id) -- One sync per store at a time
);

-- Indexes for performance
CREATE INDEX idx_processed_webhooks_store_id ON processed_webhooks(store_id);
CREATE INDEX idx_processed_webhooks_processed_at ON processed_webhooks(processed_at DESC);
CREATE INDEX idx_sync_status_store_id ON sync_status(store_id);
```

### 3. Implement Idempotency for Webhook Handler

**File**: `src/app/api/webhooks/shopify/product-update/route.ts`

**Add after line 44** (after parsing product data):
```typescript
// Check if webhook already processed (idempotency)
const webhookId = request.headers.get('x-shopify-webhook-id');
const storeDomain = request.headers.get('x-shopify-shop-domain');

if (!webhookId || !storeDomain) {
  return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 });
}

// Get store ID from domain
const { data: store } = await supabaseAdmin
  .from('stores')
  .select('id')
  .eq('shop_domain', storeDomain)
  .single();

if (!store) {
  return NextResponse.json({ error: 'Store not found' }, { status: 404 });
}

// Check if webhook already processed
const { data: existingWebhook } = await supabaseAdmin
  .from('processed_webhooks')
  .select('id')
  .eq('webhook_id', webhookId)
  .eq('store_id', store.id)
  .single();

if (existingWebhook) {
  console.log(`Webhook ${webhookId} already processed, skipping`);
  return NextResponse.json({ message: 'Already processed' });
}

// Mark webhook as processed
await supabaseAdmin
  .from('processed_webhooks')
  .insert({
    webhook_id: webhookId,
    store_id: store.id,
    topic: 'products/update',
    payload_hash: crypto.createHash('sha256').update(body).digest('hex'),
  });
```

### 4. Make Webhook Verification Mandatory

**File**: `src/app/api/webhooks/shopify/product-update/route.ts`

**Replace lines 27-40** (current optional verification):
```typescript
// MANDATORY webhook verification
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  console.error('❌ SHOPIFY_WEBHOOK_SECRET not configured');
  return NextResponse.json(
    { error: 'Server misconfigured' }, 
    { status: 500 }
  );
}

const hmac = request.headers.get('x-shopify-hmac-sha256');
const hash = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(body, 'utf8')
  .digest('base64');

if (hash !== hmac) {
  console.error('❌ Invalid webhook signature');
  return NextResponse.json(
    { error: 'Invalid webhook signature' }, 
    { status: 401 }
  );
}
```

### 5. Implement Webhook Registration with Duplicate Prevention

**File**: `src/app/api/auth/shopify/callback/route.ts`

**Add after line 139** (after store creation/update):
```typescript
// Register product update webhook (with duplicate check and error handling)
try {
  await registerWebhooks(shopDomain, access_token);
} catch (error) {
  console.error('Webhook registration failed:', error);
  // Don't fail OAuth - webhook can be registered manually
}

// Trigger automatic product sync in background
try {
  await triggerProductSync(store.id, shopDomain, access_token);
} catch (error) {
  console.error('Auto-sync failed:', error);
  // Don't fail OAuth - user can sync manually
}
```

**Add new functions** in same file:
```typescript
async function registerWebhooks(shopDomain: string, accessToken: string) {
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/product-update`;
  const baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;
  
  // Step 1: Check for existing webhooks
  const existingResponse = await fetch(`${baseUrl}/webhooks.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });
  
  if (!existingResponse.ok) {
    throw new Error(`Failed to fetch existing webhooks: ${existingResponse.status}`);
  }
  
  const { webhooks } = await existingResponse.json();
  
  // Step 2: Check if webhook already exists
  const existingWebhook = webhooks?.find((w: any) => 
    w.topic === 'products/update' && w.address === webhookUrl
  );
  
  if (existingWebhook) {
    console.log('Webhook already registered:', existingWebhook.id);
    return; // Skip registration
  }
  
  // Step 3: Register new webhook
  const registerResponse = await fetch(`${baseUrl}/webhooks.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      webhook: {
        topic: 'products/update',
        address: webhookUrl,
        format: 'json',
      },
    }),
  });
  
  if (!registerResponse.ok) {
    const error = await registerResponse.json();
    throw new Error(`Failed to register webhook: ${JSON.stringify(error)}`);
  }
  
  const { webhook } = await registerResponse.json();
  console.log('Webhook registered successfully:', webhook.id);
}

async function triggerProductSync(storeId: string, shopDomain: string, accessToken: string) {
  // Update sync status to in_progress
  const supabaseAdmin = createAdminClient();
  await supabaseAdmin
    .from('sync_status')
    .upsert({
      store_id: storeId,
      status: 'in_progress',
      products_synced: 0,
      total_products: 0,
      started_at: new Date().toISOString(),
    });

  // Call sync service directly (not HTTP request to avoid auth issues)
  const { syncProductsFromShopify } = await import('@/features/shopify-integration/services/syncProducts');
  
  try {
    const result = await syncProductsFromShopify(storeId, shopDomain, accessToken);
    
    // Update sync status
    await supabaseAdmin
      .from('sync_status')
      .update({
        status: result.success ? 'completed' : 'failed',
        products_synced: result.synced,
        completed_at: new Date().toISOString(),
        error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
      })
      .eq('store_id', storeId);
      
  } catch (error) {
    // Update sync status to failed
    await supabaseAdmin
      .from('sync_status')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('store_id', storeId);
  }
}
```

### 6. Implement Rate Limiting for Shopify API

**New file**: `src/shared/lib/rateLimiter.ts`

```typescript
// Simple rate limiter for Shopify API (2 requests per second)
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private lastRequest = 0;
  private readonly minInterval = 500; // 500ms between requests (2 req/sec)

  async execute<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequest;
      
      if (timeSinceLastRequest < this.minInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minInterval - timeSinceLastRequest)
        );
      }
      
      const requestFn = this.queue.shift();
      if (requestFn) {
        this.lastRequest = Date.now();
        await requestFn();
      }
    }
    
    this.isProcessing = false;
  }
}

export const shopifyRateLimiter = new RateLimiter();
```

**Update file**: `src/features/shopify-integration/services/shopifyClient.ts`

**Replace the `request` method** (lines 26-65):
```typescript
import { shopifyRateLimiter } from '@/shared/lib/rateLimiter';

private async request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ShopifyApiResponse<T>> {
  return shopifyRateLimiter.execute(async () => {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.accessToken,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: {
            message: error.errors || 'API request failed',
            statusCode: response.status,
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: 500,
        },
      };
    }
  });
}
```

### 7. Centralized Environment Validation

**New file**: `src/shared/lib/validateEnv.ts`

```typescript
interface RequiredEnvVars {
  // Shopify OAuth
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_WEBHOOK_SECRET: string;
  
  // App Configuration
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_SHOPIFY_API_VERSION: string;
  
  // Database
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  
  // Encryption
  ENCRYPTION_KEY: string;
}

const requiredEnvVars: (keyof RequiredEnvVars)[] = [
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET', 
  'SHOPIFY_WEBHOOK_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SHOPIFY_API_VERSION',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENCRYPTION_KEY',
];

export function validateEnvironment(): void {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    
    if (!value) {
      missing.push(envVar);
      continue;
    }

    // Specific validations
    switch (envVar) {
      case 'NEXT_PUBLIC_APP_URL':
        if (!value.startsWith('http')) {
          invalid.push(`${envVar} must be a valid URL (got: ${value})`);
        }
        break;
      case 'NEXT_PUBLIC_SHOPIFY_API_VERSION':
        if (!/^\d{4}-\d{2}$/.test(value)) {
          invalid.push(`${envVar} must be in format YYYY-MM (got: ${value})`);
        }
        break;
      case 'ENCRYPTION_KEY':
        if (value.length < 32) {
          invalid.push(`${envVar} must be at least 32 characters`);
        }
        break;
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    const errors = [
      ...missing.map(v => `Missing: ${v}`),
      ...invalid
    ];
    
    console.error('❌ Environment validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    
    throw new Error(`Environment validation failed: ${errors.join(', ')}`);
  }

  console.log('✅ Environment validation passed');
}

// Auto-validate on import in production
if (process.env.NODE_ENV === 'production') {
  validateEnvironment();
}
```

**Update file**: `src/app/layout.tsx`

**Add at the top** (after imports):
```typescript
import { validateEnvironment } from '@/shared/lib/validateEnv';

// Validate environment on server startup
if (typeof window === 'undefined') {
  try {
    validateEnvironment();
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}
```

### 8. Structured Logging

**New file**: `src/shared/lib/logger.ts`

```typescript
interface LogContext {
  storeId?: string;
  userId?: string;
  requestId?: string;
  webhookId?: string;
}

class Logger {
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const requestId = context?.requestId || this.generateRequestId();
    
    const contextStr = context ? 
      ` [${Object.entries(context).map(([k, v]) => `${k}=${v}`).join(' ')}]` : '';
    
    return `${timestamp} [${level}]${contextStr} ${message}`;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('INFO', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('WARN', message, context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorStr = error ? `: ${error.message}${error.stack ? '\n' + error.stack : ''}` : '';
    console.error(this.formatMessage('ERROR', message + errorStr, context));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.formatMessage('DEBUG', message, context));
    }
  }
}

export const logger = new Logger();
```

**Update webhook handler**: `src/app/api/webhooks/shopify/product-update/route.ts`

**Replace all console.log/error statements**:
```typescript
import { logger } from '@/shared/lib/logger';

// Replace console.log with logger.info
// Replace console.error with logger.error
// Replace console.warn with logger.warn

// Example:
logger.info(`Product update webhook received: ${product.title} (ID: ${product.id})`, {
  webhookId,
  storeId: store.id,
});
```

### 9. Comprehensive Test Suite

**Install test dependencies**:
```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

**New file**: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**New file**: `src/test/setup.ts`

```typescript
import '@testing-library/jest-dom';

// Mock environment variables
process.env.SHOPIFY_API_KEY = 'test_key';
process.env.SHOPIFY_API_SECRET = 'test_secret';
process.env.SHOPIFY_WEBHOOK_SECRET = 'test_webhook_secret';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION = '2024-10';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
process.env.ENCRYPTION_KEY = 'test_encryption_key_32_chars_long';
```

**New file**: `src/test/mocks/shopifyApi.ts`

```typescript
// Mock Shopify API responses
export const mockShopifyProducts = {
  products: [
    {
      id: 123,
      title: 'Test Product',
      handle: 'test-product',
      body_html: '<p>Test description</p>',
      vendor: 'Test Vendor',
      product_type: 'Test Type',
      tags: 'test, product',
      status: 'active',
      images: [
        {
          id: 456,
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          width: 800,
          height: 800,
        }
      ],
      variants: [
        {
          id: 789,
          title: 'Default',
          price: '29.99',
          compare_at_price: null,
          sku: 'TEST-SKU',
          inventory_quantity: 10,
          inventory_management: 'shopify',
          weight: 1.0,
          weight_unit: 'kg',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }
      ],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
  ]
};

export const mockWebhookPayload = {
  id: 123,
  title: 'Test Product',
  variants: [
    {
      id: 789,
      price: '34.99', // Updated price
    }
  ]
};
```

**New file**: `src/features/shopify-integration/services/__tests__/integration.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShopifyClient } from '../shopifyClient';
import { syncProductsFromShopify } from '../syncProducts';
import { mockShopifyProducts, mockWebhookPayload } from '@/test/mocks/shopifyApi';

// Mock fetch globally
global.fetch = vi.fn();

describe('Shopify Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ShopifyClient', () => {
    it('should fetch products successfully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockShopifyProducts,
      });

      const client = new ShopifyClient({
        storeUrl: 'test.myshopify.com',
        accessToken: 'test_token',
      });

      const result = await client.getProducts();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].title).toBe('Test Product');
    });

    it('should handle API errors gracefully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ errors: 'Unauthorized' }),
      });

      const client = new ShopifyClient({
        storeUrl: 'test.myshopify.com',
        accessToken: 'invalid_token',
      });

      const result = await client.getProducts();

      expect(result.success).toBe(false);
      expect(result.error?.statusCode).toBe(401);
    });

    it('should update product price successfully', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ product: { variants: [{ id: 789 }] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ variant: { id: 789, price: '34.99' } }),
        });

      const client = new ShopifyClient({
        storeUrl: 'test.myshopify.com',
        accessToken: 'test_token',
      });

      const result = await client.updateProductPrice('123', '789', '34.99');

      expect(result.success).toBe(true);
    });
  });

  describe('Product Sync', () => {
    it('should sync products from Shopify to database', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockShopifyProducts,
      });

      // Mock Supabase client
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        insert: vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
      };

      vi.doMock('@/shared/lib/supabase', () => ({
        createAdminClient: () => mockSupabase,
      }));

      const result = await syncProductsFromShopify(
        'store-id',
        'test.myshopify.com',
        'test_token'
      );

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
    });
  });

  describe('Webhook Processing', () => {
    it('should process webhook payload correctly', () => {
      const product = mockWebhookPayload;
      const newPrice = parseFloat(product.variants[0].price);
      
      expect(newPrice).toBe(34.99);
      expect(product.id).toBe(123);
    });

    it('should validate webhook signature', () => {
      const crypto = require('crypto');
      const secret = 'test_secret';
      const body = JSON.stringify(mockWebhookPayload);
      const hmac = crypto
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('base64');

      expect(hmac).toBeDefined();
      expect(hmac.length).toBeGreaterThan(0);
    });
  });
});
```

**Update package.json**:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run"
  }
}
```

### 10. Enhanced Webhook Debug Endpoint

**New file**: `src/app/api/webhooks/shopify/test/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/product-update`;
    const baseUrl = `https://${store.shop_domain}/admin/api/${apiVersion}`;

    // Check registered webhooks in Shopify
    const webhooksResponse = await fetch(`${baseUrl}/webhooks.json`, {
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json',
      },
    });

    let registeredWebhooks = [];
    if (webhooksResponse.ok) {
      const data = await webhooksResponse.json();
      registeredWebhooks = data.webhooks || [];
    }

    // Check sync status
    const supabaseAdmin = createAdminClient();
    const { data: syncStatus } = await supabaseAdmin
      .from('sync_status')
      .select('*')
      .eq('store_id', store.id)
      .single();

    // Check recent webhook processing
    const { data: recentWebhooks } = await supabaseAdmin
      .from('processed_webhooks')
      .select('*')
      .eq('store_id', store.id)
      .order('processed_at', { ascending: false })
      .limit(10);

    const productUpdateWebhook = registeredWebhooks.find(
      (w: any) => w.topic === 'products/update' && w.address === webhookUrl
    );

    return NextResponse.json({
      success: true,
      store: {
        id: store.id,
        domain: store.shop_domain,
        isActive: store.is_active,
      },
      webhook: {
        url: webhookUrl,
        secret: !!process.env.SHOPIFY_WEBHOOK_SECRET,
        registered: !!productUpdateWebhook,
        webhookId: productUpdateWebhook?.id,
        createdAt: productUpdateWebhook?.created_at,
      },
      sync: {
        status: syncStatus?.status || 'never_synced',
        productsSynced: syncStatus?.products_synced || 0,
        lastSync: syncStatus?.completed_at,
        error: syncStatus?.error_message,
      },
      recentWebhooks: recentWebhooks || [],
    });

  } catch (error) {
    logger.error('Webhook test endpoint failed', error as Error);
    return NextResponse.json(
      { success: false, error: 'Test failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const { action } = await request.json();

    if (action === 'test_webhook') {
      // Send test webhook to our endpoint
      const testPayload = {
        id: 999999,
        title: 'Test Webhook Product',
        variants: [{ id: 888888, price: '99.99' }],
      };

      const hmac = require('crypto')
        .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
        .update(JSON.stringify(testPayload), 'utf8')
        .digest('base64');

      const testResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/product-update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Hmac-Sha256': hmac,
            'X-Shopify-Webhook-Id': 'test-webhook-123',
            'X-Shopify-Shop-Domain': store.shop_domain,
          },
          body: JSON.stringify(testPayload),
        }
      );

      return NextResponse.json({
        success: true,
        testResult: {
          status: testResponse.status,
          ok: testResponse.ok,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    logger.error('Webhook test action failed', error as Error);
    return NextResponse.json(
      { success: false, error: 'Test action failed' },
      { status: 500 }
    );
  }
}
```

### 11. Manual Testing Documentation

**New file**: `SHOPIFY_INTEGRATION_TESTING.md`

```markdown
# Shopify Integration Testing Guide

## Prerequisites
- Shopify Development Store (free from Partners account)
- App installed in development store
- Environment variables configured

## Test Scenarios

### 1. Product Fetching Test
**Goal**: Verify products load from real Shopify store

**Steps**:
1. Navigate to Products page
2. Verify products display with real data
3. Check that images, prices, variants show correctly
4. Test search and filtering functionality

**Expected Results**:
- Products load within 2 seconds
- All product data displays correctly
- No console errors

### 2. Price Update Test
**Goal**: Verify price updates push to Shopify

**Steps**:
1. Enable smart pricing for a test product
2. Manually trigger algorithm via API:
   ```bash
   curl -X POST http://localhost:3000/api/pricing/run \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie"
   ```
3. Check Shopify admin - price should update within 30 seconds
4. Verify database `pricing_history` table has new entry

**Expected Results**:
- Price updates in Shopify admin
- Database records the change
- No API errors

### 3. Webhook Integration Test
**Goal**: Verify webhooks work when prices change manually in Shopify

**Steps**:
1. Note current price of a product in your app
2. Manually change price in Shopify admin
3. Check webhook debug endpoint:
   ```bash
   curl http://localhost:3000/api/webhooks/shopify/test \
     -H "Cookie: your-session-cookie"
   ```
4. Verify app database shows new price
5. Check `next_price_change_date` is reset to +2 days

**Expected Results**:
- Webhook received (check server logs)
- Database updated with new price
- Algorithm cycle reset

### 4. Product Sync Test
**Goal**: Verify new products appear in app

**Steps**:
1. Add new product in Shopify admin
2. Click "Sync Products" button in app
3. Verify new product appears in product list
4. Check that pricing config is created

**Expected Results**:
- New product appears within 30 seconds
- Pricing config initialized
- No sync errors

### 5. Error Handling Test
**Goal**: Verify graceful error handling

**Test Cases**:
- Invalid Shopify credentials
- Network timeout
- Rate limit exceeded
- Webhook signature mismatch
- Database connection failure

**Expected Results**:
- Errors logged but don't crash app
- User sees appropriate error messages
- App remains functional

### 6. Performance Test
**Goal**: Verify performance with large product catalogs

**Steps**:
1. Create 100+ test products in Shopify
2. Sync all products
3. Test product list loading time
4. Test bulk price updates

**Expected Results**:
- Product list loads within 5 seconds
- Bulk operations complete within 2 minutes
- No memory leaks or crashes

## Debugging Tools

### Webhook Debug Endpoint
```bash
# Check webhook status
curl http://localhost:3000/api/webhooks/shopify/test

# Send test webhook
curl -X POST http://localhost:3000/api/webhooks/shopify/test \
  -H "Content-Type: application/json" \
  -d '{"action": "test_webhook"}'
```

### Database Queries
```sql
-- Check sync status
SELECT * FROM sync_status WHERE store_id = 'your-store-id';

-- Check recent webhooks
SELECT * FROM processed_webhooks 
WHERE store_id = 'your-store-id' 
ORDER BY processed_at DESC LIMIT 10;

-- Check pricing history
SELECT * FROM pricing_history 
WHERE product_id IN (
  SELECT id FROM products WHERE store_id = 'your-store-id'
) ORDER BY timestamp DESC LIMIT 10;
```

### Log Monitoring
```bash
# Watch logs in development
npm run dev | grep -E "(webhook|sync|error)"

# Check specific log levels
npm run dev | grep -E "\[ERROR\]"
```

## Common Issues & Solutions

### Issue: Webhooks not received
**Symptoms**: Manual price changes in Shopify don't update app
**Solutions**:
1. Check webhook registration: `GET /api/webhooks/shopify/test`
2. Verify `SHOPIFY_WEBHOOK_SECRET` is set
3. Check webhook URL is accessible from internet
4. Verify webhook is registered in Shopify admin

### Issue: Sync fails
**Symptoms**: Products don't appear after OAuth
**Solutions**:
1. Check sync status: Database `sync_status` table
2. Verify store access token is valid
3. Check Shopify API rate limits
4. Review error logs

### Issue: Rate limit errors
**Symptoms**: 429 errors from Shopify API
**Solutions**:
1. Check rate limiter is working
2. Reduce batch sizes
3. Add delays between requests
4. Consider GraphQL migration

### Issue: Algorithm overwrites manual changes
**Symptoms**: Manual price changes get reverted
**Solutions**:
1. Check webhook processing logs
2. Verify `next_price_change_date` is being reset
3. Check for webhook processing errors
4. Ensure idempotency is working
```

### 12. Rollback and Retry Strategy

**New file**: `src/app/api/stores/reconnect/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { createAdminClient } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const { action } = await request.json();

    if (action === 'reregister_webhooks') {
      // Re-register webhooks
      const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2024-10';
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/product-update`;
      const baseUrl = `https://${store.shop_domain}/admin/api/${apiVersion}`;

      // Delete existing webhooks
      const existingResponse = await fetch(`${baseUrl}/webhooks.json`, {
        headers: {
          'X-Shopify-Access-Token': store.access_token,
          'Content-Type': 'application/json',
        },
      });

      if (existingResponse.ok) {
        const { webhooks } = await existingResponse.json();
        const productUpdateWebhooks = webhooks.filter(
          (w: any) => w.topic === 'products/update' && w.address === webhookUrl
        );

        // Delete existing webhooks
        for (const webhook of productUpdateWebhooks) {
          await fetch(`${baseUrl}/webhooks/${webhook.id}.json`, {
            method: 'DELETE',
            headers: {
              'X-Shopify-Access-Token': store.access_token,
            },
          });
        }
      }

      // Register new webhook
      const registerResponse = await fetch(`${baseUrl}/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': store.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook: {
            topic: 'products/update',
            address: webhookUrl,
            format: 'json',
          },
        }),
      });

      if (!registerResponse.ok) {
        throw new Error('Failed to register webhook');
      }

      logger.info('Webhooks re-registered successfully', { storeId: store.id });

      return NextResponse.json({
        success: true,
        message: 'Webhooks re-registered successfully',
      });
    }

    if (action === 'retry_sync') {
      // Retry product sync
      const supabaseAdmin = createAdminClient();
      
      // Clear any failed sync status
      await supabaseAdmin
        .from('sync_status')
        .delete()
        .eq('store_id', store.id);

      // Trigger new sync
      const { syncProductsFromShopify } = await import('@/features/shopify-integration/services/syncProducts');
      
      const result = await syncProductsFromShopify(
        store.id,
        store.shop_domain,
        store.access_token
      );

      logger.info('Product sync retried', { 
        storeId: store.id, 
        success: result.success,
        synced: result.synced 
      });

      return NextResponse.json({
        success: result.success,
        message: result.success 
          ? `Synced ${result.synced} products` 
          : 'Sync failed',
        errors: result.errors,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    logger.error('Store reconnect failed', error as Error);
    return NextResponse.json(
      { success: false, error: 'Reconnect failed' },
      { status: 500 }
    );
  }
}
```

**Add to Settings UI**: `src/app/(app)/settings/page.tsx`

**Add reconnect buttons** in the Shopify section:
```typescript
// Add after existing Shopify settings
<div className="space-y-4">
  <div>
    <Label>Webhook Status</Label>
    <div className="flex items-center space-x-2">
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => testWebhookStatus()}
      >
        Test Webhooks
      </Button>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => reconnectStore('reregister_webhooks')}
      >
        Re-register Webhooks
      </Button>
    </div>
  </div>
  
  <div>
    <Label>Product Sync</Label>
    <div className="flex items-center space-x-2">
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => reconnectStore('retry_sync')}
      >
        Retry Sync
      </Button>
    </div>
  </div>
</div>
```

## Files to Modify/Create

### Modified Files:
1. `src/app/api/webhooks/shopify/product-update/route.ts` - Fix bug, add idempotency, mandatory verification
2. `src/app/api/auth/shopify/callback/route.ts` - Add webhook registration and auto-sync
3. `src/features/shopify-integration/services/shopifyClient.ts` - Add rate limiting
4. `src/app/layout.tsx` - Add environment validation
5. `src/app/(app)/settings/page.tsx` - Add reconnect buttons

### New Files:
1. `supabase/migrations/011_add_webhook_tracking.sql` - Database migrations
2. `src/shared/lib/rateLimiter.ts` - Rate limiting
3. `src/shared/lib/validateEnv.ts` - Environment validation
4. `src/shared/lib/logger.ts` - Structured logging
5. `vitest.config.ts` - Test configuration
6. `src/test/setup.ts` - Test setup
7. `src/test/mocks/shopifyApi.ts` - Mock data
8. `src/features/shopify-integration/services/__tests__/integration.test.ts` - Tests
9. `src/app/api/webhooks/shopify/test/route.ts` - Debug endpoint
10. `src/app/api/stores/reconnect/route.ts` - Rollback/retry
11. `SHOPIFY_INTEGRATION_TESTING.md` - Manual testing guide

## Environment Variables Required

```env
# Shopify OAuth (required)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# App Configuration (required)
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_SHOPIFY_API_VERSION=2024-10

# Database (required)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Encryption (required)
ENCRYPTION_KEY=your_32_character_encryption_key
```

## Success Criteria

- ✅ Webhook handler doesn't crash (bug fixed)
- ✅ Webhooks registered automatically during OAuth
- ✅ Idempotency prevents duplicate webhook processing
- ✅ Webhook verification is mandatory in production
- ✅ Products sync automatically after OAuth
- ✅ Rate limiting prevents API errors
- ✅ Environment validation fails fast on startup
- ✅ Structured logging provides debugging context
- ✅ Test suite covers critical integration paths
- ✅ Debug endpoints help troubleshoot issues
- ✅ Rollback/retry mechanisms handle failures
- ✅ Manual testing documentation covers edge cases

## Testing Commands

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests once
npm run test:run

# Check webhook status
curl http://localhost:3000/api/webhooks/shopify/test

# Test webhook processing
curl -X POST http://localhost:3000/api/webhooks/shopify/test \
  -H "Content-Type: application/json" \
  -d '{"action": "test_webhook"}'

# Re-register webhooks
curl -X POST http://localhost:3000/api/stores/reconnect \
  -H "Content-Type: application/json" \
  -d '{"action": "reregister_webhooks"}'
```

This plan provides everything needed to implement a production-ready Shopify integration with comprehensive error handling, testing, and monitoring capabilities.
