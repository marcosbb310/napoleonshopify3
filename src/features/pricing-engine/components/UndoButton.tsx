// Undo button for smart pricing toggles
'use client';

import { Button } from '@/shared/components/ui/button';
import { Undo2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface UndoButtonProps {
  onClick: () => void;
  description: string;
  timeRemaining: string;
  variant?: 'default' | 'ghost' | 'outline';
  className?: string;
}

export function UndoButton({ 
  onClick, 
  description, 
  timeRemaining,
  variant = 'outline',
  className,
}: UndoButtonProps) {
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      className={cn('gap-2', className)}
    >
      <Undo2 className="h-4 w-4" />
      <span>Undo {description}</span>
      {timeRemaining && (
        <span className="text-xs text-muted-foreground">({timeRemaining})</span>
      )}
    </Button>
  );
}

