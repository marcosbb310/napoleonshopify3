export type SyncActivityStatus = 'success' | 'warning' | 'error';

export type SyncActivitySource = 'manual' | 'pricing' | 'diagnostics';

export interface SyncActivityEntry {
  id: string;
  storeId: string;
  status: SyncActivityStatus;
  source: SyncActivitySource;
  startedAt: string;
  completedAt?: string;
  totalProducts: number;
  syncedProducts: number;
  skippedProducts?: number;  // Products skipped due to invalid IDs
  duration: number;
  errors: string[];
  message?: string;
  errorMessage?: string | null;
}

