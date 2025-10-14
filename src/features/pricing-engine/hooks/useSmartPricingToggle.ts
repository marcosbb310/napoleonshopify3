// Hook for individual product smart pricing toggles
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ResumeOption, ProductSnapshot } from '../types';

interface UseSmartPricingToggleProps {
  productId: string;
  productName: string;
  onUndoSet?: (action: 'individual-on' | 'individual-off', snapshots: ProductSnapshot[], description: string) => void;
}

export function useSmartPricingToggle({ productId, productName, onUndoSet }: UseSmartPricingToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'enable' | 'disable' | null>(null);
  const [priceOptions, setPriceOptions] = useState<{ base: number; last: number } | null>(null);

  const handleToggle = (currentEnabled: boolean) => {
    if (currentEnabled) {
      // Turning OFF
      setPendingAction('disable');
      setShowConfirm(true);
    } else {
      // Turning ON
      setPendingAction('enable');
      setShowConfirm(true);
    }
  };

  const handleConfirmToggle = async () => {
    if (!pendingAction) return;

    setIsLoading(true);
    setShowConfirm(false);

    try {
      if (pendingAction === 'disable') {
        // Call API to disable
        const response = await fetch(`/api/pricing/config/${productId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auto_pricing_enabled: false }),
        });

        const data = await response.json();

        if (data.success && data.reverted) {
          toast.success(`Smart pricing disabled for ${productName}`, {
            description: `Price reverted to $${data.revertedTo.toFixed(2)}`,
          });

          // Set undo state
          if (onUndoSet && data.snapshot) {
            onUndoSet('individual-off', [data.snapshot], productName);
          }
        } else {
          toast.error('Failed to disable smart pricing');
        }
      } else {
        // Enable - get price options first
        const response = await fetch(`/api/pricing/config/${productId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auto_pricing_enabled: true }),
        });

        const data = await response.json();

        if (data.success && data.showModal) {
          // Show resume modal
          setPriceOptions({
            base: data.preSmart,
            last: data.lastSmart,
          });
          setShowResumeModal(true);
        } else {
          toast.error('Failed to enable smart pricing');
        }
      }
    } catch (error) {
      toast.error('An error occurred');
      console.error(error);
    } finally {
      setIsLoading(false);
      setPendingAction(null);
    }
  };

  const handleResumeConfirm = async (option: ResumeOption) => {
    setIsLoading(true);
    setShowResumeModal(false);

    try {
      const response = await fetch('/api/pricing/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, resumeOption: option }),
      });

      const data = await response.json();

      if (data.success) {
        const optionText = option === 'base' ? 'base price' : 'last smart price';
        toast.success(`Smart pricing enabled for ${productName}`, {
          description: `Starting at $${data.price.toFixed(2)} (${optionText})`,
        });

        // Set undo state
        if (onUndoSet && data.snapshot) {
          onUndoSet('individual-on', [data.snapshot], productName);
        }
      } else {
        toast.error('Failed to enable smart pricing');
      }
    } catch (error) {
      toast.error('An error occurred');
      console.error(error);
    } finally {
      setIsLoading(false);
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

