// Hook for individual product smart pricing toggles
'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { ResumeOption, ProductSnapshot } from '../types';
import { useUpdatePricingConfig, useResumeProduct } from './useSmartPricingMutations';

interface UseSmartPricingToggleProps {
  productId: string;
  productName: string;
  onUndoSet?: (action: 'individual-on' | 'individual-off', snapshots: ProductSnapshot[], description: string) => void;
}

export function useSmartPricingToggle({ productId, productName, onUndoSet }: UseSmartPricingToggleProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'enable' | 'disable' | null>(null);
  const [priceOptions, setPriceOptions] = useState<{ base: number; last: number } | null>(null);

  // React Query mutations
  const updateConfigMutation = useUpdatePricingConfig();
  const resumeProductMutation = useResumeProduct();
  
  // Loading state from mutations - memoized to prevent infinite re-renders
  const isLoading = useMemo(
    () => updateConfigMutation.isPending || resumeProductMutation.isPending,
    [updateConfigMutation.isPending, resumeProductMutation.isPending]
  );

  const handleToggle = async (currentEnabled: boolean) => {
    if (currentEnabled) {
      // Turning OFF - show confirmation
      setPendingAction('disable');
      setShowConfirm(true);
    } else {
      // Turning ON - skip confirmation, go directly to resume modal
      setPendingAction('enable');
      
      try {
        const data = await updateConfigMutation.mutateAsync({
          productId,
          auto_pricing_enabled: true,
        });

        if (data.showModal) {
          // Show resume modal directly
          setPriceOptions({
            base: data.preSmart!,
            last: data.lastSmart!,
          });
          setShowResumeModal(true);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to enable smart pricing');
        console.error('Smart pricing toggle error:', error);
      }
    }
  };

  const handleConfirmToggle = async () => {
    if (!pendingAction) return;

    setShowConfirm(false);

    try {
      // Only handle disable here since enable goes directly to resume modal
      if (pendingAction === 'disable') {
        const data = await updateConfigMutation.mutateAsync({
          productId,
          auto_pricing_enabled: false,
        });

        if (data.reverted) {
          toast.success(`Smart pricing disabled for ${productName}`, {
            description: `Price reverted to $${data.revertedTo!.toFixed(2)}`,
          });

          // Set undo state
          if (onUndoSet && data.snapshot) {
            onUndoSet('individual-off', [data.snapshot], productName);
          }
          
          return data; // Return data for parent to handle
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
      console.error('Smart pricing toggle error:', error);
    } finally {
      setPendingAction(null);
    }
  };

  const handleResumeConfirm = async (option: ResumeOption) => {
    setShowResumeModal(false);

    try {
      const data = await resumeProductMutation.mutateAsync({
        productId,
        resumeOption: option,
      });

      const optionText = option === 'base' ? 'base price' : 'last smart price';
      toast.success(`Smart pricing enabled for ${productName}`, {
        description: `Starting at $${data.price.toFixed(2)} (${optionText})`,
      });

      // Set undo state
      if (onUndoSet && data.snapshot) {
        onUndoSet('individual-on', [data.snapshot], productName);
      }
      
      return data; // Return data for parent to handle
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
      console.error('Smart pricing resume error:', error);
    }
  };

  return {
    isLoading,
    showConfirm,
    setShowConfirm,
    showResumeModal,
    setShowResumeModal,
    pendingAction,
    priceOptions,
    handleToggle,
    handleConfirmToggle,
    handleResumeConfirm,
  };
}

