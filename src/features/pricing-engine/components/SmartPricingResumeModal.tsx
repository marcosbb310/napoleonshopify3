// Modal for choosing smart pricing resume strategy
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Label } from '@/shared/components/ui/label';
import { ResumeOption } from '../types';

interface SmartPricingResumeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (option: ResumeOption) => void;
  productName?: string;
  productCount?: number;
  basePrice: number;
  lastSmartPrice: number;
}

export function SmartPricingResumeModal({
  open,
  onOpenChange,
  onConfirm,
  productName,
  productCount,
  basePrice,
  lastSmartPrice,
}: SmartPricingResumeModalProps) {
  const [selectedOption, setSelectedOption] = useState<ResumeOption>('base');

  const isGlobal = productCount !== undefined;
  const priceDiff = lastSmartPrice - basePrice;
  const percentDiff = ((priceDiff / basePrice) * 100).toFixed(1);

  const handleConfirm = () => {
    onConfirm(selectedOption);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resume Smart Pricing</DialogTitle>
          <DialogDescription>
            {isGlobal
              ? `Choose how to resume smart pricing for ${productCount} products`
              : `Choose how to resume smart pricing for ${productName || 'this product'}`}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={selectedOption} onValueChange={(value) => setSelectedOption(value as ResumeOption)} className="gap-4">
          <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent" onClick={() => setSelectedOption('base')}>
            <RadioGroupItem value="base" id="base" className="mt-1" />
            <div className="flex-1 space-y-1">
              <Label htmlFor="base" className="font-medium cursor-pointer">
                Start from base price
              </Label>
              <p className="text-sm text-muted-foreground">
                {isGlobal ? 'Average: ' : ''}${basePrice.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Conservative restart - algorithm will climb from the original baseline
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent" onClick={() => setSelectedOption('last')}>
            <RadioGroupItem value="last" id="last" className="mt-1" />
            <div className="flex-1 space-y-1">
              <Label htmlFor="last" className="font-medium cursor-pointer">
                Resume from last smart price
              </Label>
              <p className="text-sm text-muted-foreground">
                {isGlobal ? 'Average: ' : ''}${lastSmartPrice.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Trust previous work - continue from where the algorithm left off
              </p>
            </div>
          </div>
        </RadioGroup>

        {priceDiff !== 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Difference: {priceDiff > 0 ? '+' : ''}${Math.abs(priceDiff).toFixed(2)} ({priceDiff > 0 ? '+' : ''}{percentDiff}%)
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

