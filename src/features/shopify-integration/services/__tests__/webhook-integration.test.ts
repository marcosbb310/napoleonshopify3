import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifyShopifyWebhook } from '@/shared/lib/webhookVerification';

describe('Webhook Integration', () => {
  it('should verify valid HMAC', () => {
    const body = JSON.stringify({ test: 'data' });
    const secret = 'test-secret';
    const hmac = createHmac('sha256', secret).update(body).digest('base64');
    
    expect(verifyShopifyWebhook(body, hmac, secret)).toBe(true);
  });
  
  it('should reject invalid HMAC', () => {
    expect(verifyShopifyWebhook('body', 'invalid', 'secret')).toBe(false);
  });
});
