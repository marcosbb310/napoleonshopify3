// Hook for individual product smart pricing toggles
'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { ResumeOption, ProductSnapshot } from '../types';
import { useUpdatePricingConfig, useResumeProduct } from './useSmartPricingMutations';
import { useSmartPricing } from './useSmartPricing';

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

  // Get context to update product state
  const { setProductState } = useSmartPricing();

  // React Query mutations
  const updateConfigMutation = useUpdatePricingConfig();
  const resumeProductMutation = useResumeProduct();
  
  // Loading state from mutations - memoized to prevent infinite re-renders
  const isLoading = useMemo(
    () => updateConfigMutation.isPending || resumeProductMutation.isPending,
    [updateConfigMutation.isPending, resumeProductMutation.isPending]
  );

  const handleToggle = async (currentEnabled: boolean) => {
    console.log(`🔘 [${productName}] Toggle clicked - Current state:`, currentEnabled);
    
    if (currentEnabled) {
      // Turning OFF - show confirmation
      console.log(`🔴 [${productName}] Turning OFF - showing confirmation dialog`);
      setPendingAction('disable');
      setShowConfirm(true);
    } else {
      // Turning ON - skip confirmation, go directly to resume modal
      console.log(`🟢 [${productName}] Turning ON - calling API`);
      setPendingAction('enable');
      
      try {
        const data = await updateConfigMutation.mutateAsync({
          productId,
          auto_pricing_enabled: true,
        });
        
        console.log(`✅ [${productName}] API response:`, data);

        if (data.showModal) {
          // Show resume modal directly
          console.log(`📋 [${productName}] Showing resume modal`);
          setPriceOptions({
            base: data.preSmart!,
            last: data.lastSmart!,
          });
          setShowResumeModal(true);
        } else {
          // No modal needed - enabled successfully
          console.log(`✨ [${productName}] No modal needed - updating state immediately`);
          setProductState(productId, true);
          setPendingAction(null);
          toast.success(`Smart pricing enabled for ${productName}`);
        }
      } catch (error) {
        console.error(`❌ [${productName}] Toggle error:`, error);
        toast.error(error instanceof Error ? error.message : 'Failed to enable smart pricing');
        setPendingAction(null);
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
          // Update local state immediately for instant UI feedback
          setProductState(productId, false);
          
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
    console.log(`📝 [${productName}] Resume modal confirmed with option:`, option);
    setShowResumeModal(false);

    try {
      const data = await resumeProductMutation.mutateAsync({
        productId,
        resumeOption: option,
      });
      
      console.log(`✅ [${productName}] Resume API response:`, data);

      // Update local state immediately for instant UI feedback
      console.log(`🔄 [${productName}] Setting product state to TRUE`);
      setProductState(productId, true);

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
      console.error(`❌ [${productName}] Resume error:`, error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setPendingAction(null);
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

