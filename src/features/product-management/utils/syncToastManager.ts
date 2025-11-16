import { toast } from 'sonner';
import { SyncToastContent } from '../components/SyncToastContent';
import type { SyncActivityEntry, SyncActivityStatus } from '../types';

type ToastId = string | number;

interface SyncToastManagerConfig {
  onViewDetails: (entry: SyncActivityEntry) => void;
}

interface NotifyOptions {
  retry?: () => void;
}

interface LoadingOptions {
  message?: string;
  description?: string;
}

export class SyncToastManager {
  private loadingToastId: ToastId | null = null;

  constructor(private readonly config: SyncToastManagerConfig) {}

  showLoading(options: LoadingOptions = {}) {
    if (this.loadingToastId) {
      toast.dismiss(this.loadingToastId);
    }

    this.loadingToastId = toast.loading(options.message ?? 'Syncing products...', {
      description: options.description,
      duration: Infinity,
    });

    return this.loadingToastId;
  }

  notify(entry: SyncActivityEntry, options: NotifyOptions = {}) {
    this.dismissLoader();

    const status = entry.status;
    if (status === 'success') {
      this.showSuccess(entry);
      return;
    }

    if (status === 'warning') {
      this.showWarning(entry, options);
      return;
    }

    this.showError(entry, options);
  }

  dismissLoader() {
    if (this.loadingToastId) {
      toast.dismiss(this.loadingToastId);
      this.loadingToastId = null;
    }
  }

  private showSuccess(entry: SyncActivityEntry) {
    toast.custom(
      (toastInstance) => (
        <SyncToastContent
          toastId={toastInstance.id}
          entry={entry}
          status="success"
          onDismiss={() => toast.dismiss(toastInstance.id)}
          onViewDetails={() => {
            toast.dismiss(toastInstance.id);
            this.config.onViewDetails(entry);
          }}
        />
      ),
      {
        id: this.toastIdFor(entry),
        duration: 8000,
        closeButton: true,
      }
    );
  }

  private showWarning(entry: SyncActivityEntry, options: NotifyOptions) {
    toast.custom(
      (toastInstance) => (
        <SyncToastContent
          toastId={toastInstance.id}
          entry={entry}
          status="warning"
          onDismiss={() => toast.dismiss(toastInstance.id)}
          onViewDetails={() => {
            toast.dismiss(toastInstance.id);
            this.config.onViewDetails(entry);
          }}
        />
      ),
      {
        id: this.toastIdFor(entry),
        duration: 10000,
        closeButton: true,
      }
    );
  }

  private showError(entry: SyncActivityEntry, options: NotifyOptions) {
    toast.custom(
      (toastInstance) => (
        <SyncToastContent
          toastId={toastInstance.id}
          entry={entry}
          status="error"
          onDismiss={() => toast.dismiss(toastInstance.id)}
          onViewDetails={() => {
            toast.dismiss(toastInstance.id);
            this.config.onViewDetails(entry);
          }}
          onRetry={
            options.retry
              ? () => {
                  toast.dismiss(toastInstance.id);
                  options.retry?.();
                }
              : undefined
          }
        />
      ),
      {
        id: this.toastIdFor(entry),
        duration: Infinity,
        closeButton: true,
      }
    );
  }

  private toastIdFor(entry: SyncActivityEntry): string {
    return `sync-${entry.id}`;
  }
}

export function deriveStatusFromResult(result: SyncActivityEntry['errors'], syncedProducts: number): SyncActivityStatus {
  if (result.length === 0) {
    return 'success';
  }

  if (syncedProducts > 0) {
    return 'warning';
  }

  return 'error';
}

