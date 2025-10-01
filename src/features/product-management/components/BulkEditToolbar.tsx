// Bulk edit dialog component
'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { DollarSign, AlertTriangle, Trash2 } from 'lucide-react';

interface BulkEditToolbarProps {
  selectedCount: number;
  selectedIds?: string[];
  totalProductCount?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onBulkUpdate?: (updates: {
    type: 'percentage' | 'fixed';
    value: number;
    applyTo: 'basePrice' | 'maxPrice' | 'cost' | 'currentPrice';
    productIds: string[];
  }) => void;
  onBulkDelete?: (productIds: string[]) => void;
}

export function BulkEditToolbar({ selectedCount, selectedIds = [], totalProductCount = 0, open: externalOpen, onOpenChange, onBulkUpdate, onBulkDelete }: BulkEditToolbarProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const showDialog = externalOpen !== undefined ? externalOpen : internalOpen;
  const setShowDialog = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [editType, setEditType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [applyTo, setApplyTo] = useState<'basePrice' | 'maxPrice' | 'cost' | 'currentPrice'>('basePrice');

  const handleApply = () => {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      console.error('Invalid number value');
      return;
    }

    if (!onBulkUpdate) {
      console.error('No onBulkUpdate callback provided');
      return;
    }

    // If applying to all products (no selection), show confirmation
    if (selectedIds.length === 0) {
      setShowConfirmation(true);
    } else {
      // If applying to selected products, no confirmation needed
      executeUpdate(numValue);
    }
  };

  const executeUpdate = (numValue: number) => {
    console.log('Calling onBulkUpdate with:', {
      type: editType,
      value: numValue,
      applyTo,
      productIds: selectedIds,
    });

    onBulkUpdate!({
      type: editType,
      value: numValue,
      applyTo,
      productIds: selectedIds,
    });

    setShowDialog(false);
    setShowConfirmation(false);
    setValue('');
  };

  const handleConfirm = () => {
    const numValue = parseFloat(value);
    executeUpdate(numValue);
  };

  const getChangeDescription = () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';

    const field = applyTo === 'basePrice' ? 'Base Price' : applyTo === 'maxPrice' ? 'Max Price' : applyTo === 'currentPrice' ? 'Current Price' : 'Cost';
    const change = editType === 'percentage' 
      ? `${numValue > 0 ? 'increase' : 'decrease'} by ${Math.abs(numValue)}%`
      : `${numValue > 0 ? 'add' : 'subtract'} $${Math.abs(numValue)}`;

    return `${field}: ${change}`;
  };

  const handleBulkDelete = () => {
    if (!onBulkDelete) {
      console.error('No onBulkDelete callback provided');
      return;
    }

    if (selectedIds.length === 0) {
      console.error('No products selected for deletion');
      return;
    }

    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = () => {
    if (onBulkDelete && selectedIds.length > 0) {
      onBulkDelete(selectedIds);
      setShowDeleteConfirmation(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button 
              variant="default" 
              className="gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Bulk Edit Pricing
              {selectedCount > 0 && (
                <span className="ml-1 rounded-full bg-background/20 px-2 py-0.5 text-xs">
                  {selectedCount}
                </span>
              )}
            </Button>
          </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Edit Pricing</DialogTitle>
            <DialogDescription>
              {selectedCount > 0 ? (
                <>Update pricing for {selectedCount} selected product{selectedCount > 1 ? 's' : ''}</>
              ) : (
                <>Apply pricing changes to <span className="font-semibold text-primary">all products</span>. Select specific products first if you want to target only certain items.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Apply To</Label>
              <Select value={applyTo} onValueChange={(v) => setApplyTo(v as 'basePrice' | 'maxPrice' | 'cost' | 'currentPrice')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basePrice">Base Price</SelectItem>
                  <SelectItem value="maxPrice">Max Price</SelectItem>
                  <SelectItem value="currentPrice">Current Price</SelectItem>
                  <SelectItem value="cost">Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Update Type</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as 'percentage' | 'fixed')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Value</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={editType === 'percentage' ? 'e.g., 10' : 'e.g., 5.00'}
                  className="pr-12"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {editType === 'percentage' ? '%' : '$'}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {editType === 'percentage' 
                  ? 'Enter percentage to increase (positive) or decrease (negative)'
                  : 'Enter dollar amount to add (positive) or subtract (negative)'
                }
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={!value}>
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Bulk Price Change
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <span className="block text-base font-medium text-foreground">
                You are about to update <span className="text-primary font-bold">{totalProductCount} products</span>:
              </span>
              <span className="block bg-muted p-3 rounded-md border-l-4 border-primary">
                <span className="block font-semibold text-sm">{getChangeDescription()}</span>
              </span>
              <span className="block text-sm">
                This action will affect all products in your store. You can undo this change after applying it.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-primary">
              Confirm & Apply Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Button */}
      {selectedCount > 0 && onBulkDelete && (
        <Button 
          variant="destructive" 
          className="gap-2"
          onClick={handleBulkDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete Selected
          <span className="ml-1 rounded-full bg-background/20 px-2 py-0.5 text-xs">
            {selectedCount}
          </span>
        </Button>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirm Product Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <span className="block text-base font-medium text-foreground">
                Are you sure you want to delete <span className="text-primary font-bold">{selectedIds.length} product{selectedIds.length > 1 ? 's' : ''}</span>?
              </span>
              <span className="block bg-red-50 p-3 rounded-md border-l-4 border-red-500">
                <span className="block font-semibold text-sm text-red-800">
                  This action cannot be undone. All product data, including pricing, images, and variants will be permanently deleted.
                </span>
              </span>
              <span className="block text-sm text-muted-foreground">
                Make sure you have backed up any important data before proceeding.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete Products
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </>
  );
}
