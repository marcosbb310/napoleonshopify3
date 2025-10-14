// Confirmation dialogs for smart pricing toggles
'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';

interface SmartPricingConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  type: 'enable' | 'disable' | 'global-enable' | 'global-disable';
  productName?: string;
  productCount?: number;
}

export function SmartPricingConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  type,
  productName,
  productCount,
}: SmartPricingConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const getContent = () => {
    switch (type) {
      case 'enable':
        return {
          title: 'Enable Smart Pricing',
          description: `Turn on smart pricing for ${productName || 'this product'}? You'll choose a starting price next.`,
        };
      case 'disable':
        return {
          title: 'Disable Smart Pricing',
          description: `Turn off smart pricing for ${productName || 'this product'}? The price will revert to its base price.`,
        };
      case 'global-enable':
        return {
          title: 'Enable Smart Pricing Globally',
          description: `Enable smart pricing for ${productCount || 'all'} products? You'll choose a starting price strategy next.`,
        };
      case 'global-disable':
        return {
          title: '⚠️ Disable Smart Pricing Globally',
          description: `Are you sure you want to disable smart pricing for ${productCount || 'all'} products? All prices will revert to their base prices. You can undo this action within 10 minutes.`,
        };
    }
  };

  const content = getContent();
  const isGlobalDisable = type === 'global-disable';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{content.title}</AlertDialogTitle>
          <AlertDialogDescription>{content.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className={isGlobalDisable ? 'bg-destructive hover:bg-destructive/90' : ''}>
            {isGlobalDisable ? 'Disable All' : 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

