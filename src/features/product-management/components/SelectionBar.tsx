// Selection status bar component
'use client';

import { Button } from '@/shared/components/ui/button';
import { X } from 'lucide-react';

interface SelectionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onEnableSmartPricing?: () => void;
  onDisableSmartPricing?: () => void;
}

export function SelectionBar({ selectedCount, onClearSelection }: SelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 rounded-lg border bg-card px-6 py-3 shadow-lg">
        <span className="text-sm font-medium">
          {selectedCount} product{selectedCount > 1 ? 's' : ''} selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-8 gap-2"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
