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
