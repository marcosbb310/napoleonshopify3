import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { Info, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import type { SyncActivityEntry, SyncActivityStatus } from '../types';

const statusLabel: Record<SyncActivityStatus, string> = {
  success: 'Sync complete',
  warning: 'Sync completed with warnings',
  error: 'Sync failed',
};

const statusAccent: Record<SyncActivityStatus, string> = {
  success: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-500 border border-amber-500/30',
  error: 'bg-destructive/10 text-destructive border border-destructive/30',
};

function formatDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '—';
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface SyncToastContentProps {
  entry: SyncActivityEntry;
  status: SyncActivityStatus;
  onDismiss: () => void;
  onViewDetails: () => void;
  onRetry?: () => void;
}

export function SyncToastContent({
  entry,
  status,
  onDismiss,
  onViewDetails,
  onRetry,
}: SyncToastContentProps) {
  const icon = useMemo(() => {
    if (status === 'warning') {
      return <TriangleAlert className="h-4 w-4 text-amber-500" />;
    }
    if (status === 'error') {
      return <TriangleAlert className="h-4 w-4 text-destructive" />;
    }
    return <Info className="h-4 w-4 text-emerald-500" />;
  }, [status]);

  return (
    <div className="flex w-[320px] flex-col gap-3 rounded-lg border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold leading-tight text-foreground">
              {statusLabel[status]}
            </p>
            <Badge className={cn('text-[10px] uppercase tracking-wider', statusAccent[status])}>
              {entry.source}
            </Badge>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              Synced{' '}
              <span className="font-medium text-foreground">
                {entry.syncedProducts}/{entry.totalProducts}
              </span>{' '}
              products
              {entry.skippedProducts && entry.skippedProducts > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-amber-600">
                    {entry.skippedProducts} skipped
                  </span>
                </>
              )}
            </p>
            <p>
              Duration:{' '}
              <span className="font-medium text-foreground">{formatDuration(entry.duration)}</span>
            </p>
            <p>
              Completed at:{' '}
              <span className="font-medium text-foreground">{formatTimestamp(entry.completedAt)}</span>
            </p>
            {entry.errors.length > 0 && (
              <p className="text-amber-600">
                {entry.errors.length} issue{entry.errors.length > 1 ? 's' : ''}
              </p>
            )}
            {status === 'error' && entry.errorMessage && (
              <p className="text-destructive">{entry.errorMessage}</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onViewDetails}>
          View details
        </Button>
        <Button size="sm" onClick={onDismiss}>
          Close
        </Button>
      </div>
    </div>
  );
}

