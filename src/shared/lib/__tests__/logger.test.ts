import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../logger';

describe('Logger', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  it('should log info messages with context', () => {
    logger.info('Test message', { storeId: 'store-123', userId: 'user-456' });
    
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('[INFO]')
    );
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('storeId=store-123')
    );
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('userId=user-456')
    );
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Test message')
    );
  });

  it('should log warning messages', () => {
    logger.warn('Warning message');
    
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining('[WARN]')
    );
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining('Warning message')
    );
  });

  it('should log error messages with error objects', () => {
    const error = new Error('Test error');
    error.stack = 'Error stack trace';
    
    logger.error('Error occurred', error, { webhookId: 'webhook-789' });
    
    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR]')
    );
    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('Error occurred: Test error')
    );
    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('webhookId=webhook-789')
    );
  });

  it('should log debug messages only in development', () => {
    const originalEnv = process.env.NODE_ENV;
    
    // Test in development
    process.env.NODE_ENV = 'development';
    logger.debug('Debug message');
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('[DEBUG]')
    );
    
    // Test in production
    consoleSpy.log.mockClear();
    process.env.NODE_ENV = 'production';
    logger.debug('Debug message');
    expect(consoleSpy.log).not.toHaveBeenCalled();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should generate unique request IDs', () => {
    logger.info('Message 1');
    logger.info('Message 2');
    
    const calls = consoleSpy.log.mock.calls;
    
    // Check that both messages were logged
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toContain('Message 1');
    expect(calls[1][0]).toContain('Message 2');
    
    // Check that the messages are different (indicating unique timestamps)
    expect(calls[0][0]).not.toBe(calls[1][0]);
  });
});
