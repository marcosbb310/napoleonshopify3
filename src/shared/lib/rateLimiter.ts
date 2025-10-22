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
