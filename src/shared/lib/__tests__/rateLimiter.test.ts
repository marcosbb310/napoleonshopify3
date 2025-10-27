import { describe, it, expect, vi } from 'vitest';
import { shopifyRateLimiter } from '../rateLimiter';

describe('Rate Limiter', () => {
  it('should execute requests sequentially', async () => {
    const start = Date.now();
    const results: number[] = [];

    // Execute 3 requests
    const promises = [
      shopifyRateLimiter.execute(async () => {
        results.push(1);
        return 1;
      }),
      shopifyRateLimiter.execute(async () => {
        results.push(2);
        return 2;
      }),
      shopifyRateLimiter.execute(async () => {
        results.push(3);
        return 3;
      }),
    ];

    const values = await Promise.all(promises);
    const end = Date.now();

    // Should take at least 1 second (2 requests per second = 500ms between requests)
    expect(end - start).toBeGreaterThanOrEqual(1000);
    expect(values).toEqual([1, 2, 3]);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle errors properly', async () => {
    let errorThrown = false;
    
    try {
      await shopifyRateLimiter.execute(async () => {
        throw new Error('Test error');
      });
    } catch (error) {
      errorThrown = true;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Test error');
    }

    expect(errorThrown).toBe(true);
  });

  it('should handle empty queue correctly', async () => {
    // This should not throw or hang
    const result = await shopifyRateLimiter.execute(async () => {
      return 'test';
    });
    
    expect(result).toBe('test');
  });
});
