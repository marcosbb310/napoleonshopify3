import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { SyncActivityEntry } from '../types';

interface SyncActivityPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: SyncActivityEntry[];
  activeEntryId?: string | null;
  onSelectEntry?: (entryId: string) => void;
}

const statusBadgeClass: Record<SyncActivityEntry['status'], string> = {
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
  return date.toLocaleString();
}

export function SyncActivityPanel({
  open,
  onOpenChange,
  entries,
  activeEntryId,
  onSelectEntry,
}: SyncActivityPanelProps) {
  const activeEntry = useMemo(() => {
    if (entries.length === 0) return null;
    if (activeEntryId) {
      return entries.find((entry) => entry.id === activeEntryId) ?? entries[0];
    }
    return entries[0];
  }, [entries, activeEntryId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl space-y-4">
        <DialogHeader>
          <DialogTitle>Sync Activity</DialogTitle>
          <DialogDescription>
            Review recent sync runs for selected store. Click a row to view details.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-4">
          <ScrollArea className="h-72 w-1/2 rounded-md border">
            <div className="divide-y">
              {entries.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No recent sync runs yet.</p>
              )}
              {entries.map((entry) => {
                const isActive = activeEntry?.id === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onSelectEntry?.(entry.id)}
                    className={cn(
                      'flex w-full flex-col gap-1 bg-background p-4 text-left transition hover:bg-accent',
                      isActive && 'bg-accent/30'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {formatTimestamp(entry.completedAt ?? entry.startedAt)}
                      </span>
                      <Badge className={cn('text-[10px] uppercase tracking-wide', statusBadgeClass[entry.status])}>
                        {entry.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.syncedProducts}/{entry.totalProducts} products
                      {entry.skippedProducts && entry.skippedProducts > 0 && (
                        <span className="text-amber-600"> · {entry.skippedProducts} skipped</span>
                      )}
                      {' · '}
                      {formatDuration(entry.duration)}
                    </div>
                    {entry.errorMessage && (
                      <p className="text-xs text-destructive">{entry.errorMessage}</p>
                    )}
                    {entry.errors.length > 0 && (
                      <p className="text-xs text-amber-600">
                        {entry.errors.length} issue{entry.errors.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          <div className="flex w-1/2 flex-col gap-3 rounded-md border p-4">
            {activeEntry ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {activeEntry.status === 'success'
                        ? 'Completed successfully'
                        : activeEntry.status === 'warning'
                        ? 'Completed with warnings'
                        : 'Failed'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started {formatTimestamp(activeEntry.startedAt)}
                    </p>
                  </div>
                  <Badge className={cn('text-[10px] uppercase tracking-wide', statusBadgeClass[activeEntry.status])}>
                    {activeEntry.source}
                  </Badge>
                </div>
                <div className="rounded-md bg-muted/40 p-3 text-xs">
                  <p>
                    Synced{' '}
                    <span className="font-medium text-foreground">
                      {activeEntry.syncedProducts}/{activeEntry.totalProducts}
                    </span>{' '}
                    products
                    {activeEntry.skippedProducts && activeEntry.skippedProducts > 0 && (
                      <>
                        {' · '}
                        <span className="font-medium text-amber-600">
                          {activeEntry.skippedProducts} skipped
                        </span>
                      </>
                    )}
                  </p>
                  <p>
                    Duration:{' '}
                    <span className="font-medium text-foreground">
                      {formatDuration(activeEntry.duration)}
                    </span>
                  </p>
                  {activeEntry.errorMessage && (
                    <p className="text-destructive">Error: {activeEntry.errorMessage}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Issues</p>
                  <ScrollArea className="h-32 rounded-md border">
                    <div className="space-y-2 p-3 text-xs">
                      {activeEntry.errors.length === 0 && (
                        <p className="text-muted-foreground">No issues reported.</p>
                      )}
                      {activeEntry.errors.map((error, index) => (
                        <p key={`${activeEntry.id}-error-${index}`} className="text-amber-600">
                          • {error}
                        </p>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a sync run to view details.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

