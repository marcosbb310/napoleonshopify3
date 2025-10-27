'use client';

import React from 'react';
import { Power, Zap } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface PowerButtonProps {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function PowerButton({ 
  enabled, 
  onToggle, 
  disabled = false,
  label = "Global Smart Pricing",
  className 
}: PowerButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div 
      className={cn(
        "relative inline-flex items-center gap-3 group",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated Label - slides in from left */}
      <div 
        className={cn(
          "flex items-center gap-2 overflow-hidden transition-all duration-300 ease-out",
          isHovered ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
        )}
      >
        <Zap className={cn(
          "h-4 w-4 transition-colors flex-shrink-0",
          enabled ? "text-primary" : "text-muted-foreground"
        )} />
        <span className={cn(
          "text-sm font-medium whitespace-nowrap transition-colors",
          enabled ? "text-foreground" : "text-muted-foreground"
        )}>
          {label}
        </span>
        <span className={cn(
          "text-xs font-semibold px-1.5 py-0.5 rounded transition-colors flex-shrink-0",
          enabled 
            ? "bg-primary/10 text-primary" 
            : "bg-muted text-muted-foreground"
        )}>
          {enabled ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Power Button */}
      <button
        onClick={onToggle}
        disabled={disabled}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all duration-300",
          "w-12 h-12 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          enabled 
            ? "bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl" 
            : "bg-muted hover:bg-muted/80 border-2 border-border"
        )}
        aria-label={`${enabled ? 'Disable' : 'Enable'} ${label}`}
        aria-pressed={enabled}
      >
        {/* Glowing ring when active */}
        {enabled && (
          <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-primary" />
        )}
        
        {/* Power icon */}
        <Power className={cn(
          "h-5 w-5 transition-all duration-300",
          enabled ? "text-primary-foreground rotate-0" : "text-muted-foreground rotate-180"
        )} />
      </button>
    </div>
  );
}

