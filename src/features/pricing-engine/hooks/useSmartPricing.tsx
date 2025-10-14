// Smart pricing state management hook
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ProductSnapshot, ResumeOption } from '../types';

type ReactNode = React.ReactNode;

interface SmartPricingContextType {
  globalEnabled: boolean;
  setGlobalEnabled: (enabled: boolean) => Promise<void>;
  handleGlobalToggle: (currentEnabled: boolean) => void;
  confirmGlobalDisable: () => Promise<void>;
  confirmGlobalEnable: () => void;
  confirmGlobalResume: (option: ResumeOption) => Promise<void>;
  isLoadingGlobal: boolean;
  showGlobalConfirm: boolean;
  setShowGlobalConfirm: (show: boolean) => void;
  showGlobalResumeModal: boolean;
  setShowGlobalResumeModal: (show: boolean) => void;
  pendingGlobalAction: 'enable' | 'disable' | null;
  globalPriceOptions: { base: number; last: number } | null;
  productStates: Map<string, boolean>;
  setProductState: (productId: string, enabled: boolean) => void;
  setMultipleProductStates: (productIds: string[], enabled: boolean) => void;
  isProductEnabled: (productId: string) => boolean;
  globalSnapshots: ProductSnapshot[] | null;
  setGlobalSnapshots: (snapshots: ProductSnapshot[] | null) => void;
}

const SmartPricingContext = createContext<SmartPricingContextType | undefined>(undefined);

export function SmartPricingProvider({ children }: { children: ReactNode }) {
  const [globalEnabled, setGlobalEnabledState] = useState(true);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  const [productStates, setProductStates] = useState<Map<string, boolean>>(new Map());
  const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);
  const [showGlobalResumeModal, setShowGlobalResumeModal] = useState(false);
  const [pendingGlobalAction, setPendingGlobalAction] = useState<'enable' | 'disable' | null>(null);
  const [globalPriceOptions, setGlobalPriceOptions] = useState<{ base: number; last: number } | null>(null);
  const [globalSnapshots, setGlobalSnapshots] = useState<ProductSnapshot[] | null>(null);
  const [productCount, setProductCount] = useState(0);

  // Handle global toggle click
  const handleGlobalToggle = (currentEnabled: boolean) => {
    setPendingGlobalAction(currentEnabled ? 'disable' : 'enable');
    setShowGlobalConfirm(true);
  };

  // Confirm global disable
  const confirmGlobalDisable = async () => {
    setIsLoadingGlobal(true);
    setShowGlobalConfirm(false);

    // Show loading toast
    const loadingToast = toast.loading('Disabling smart pricing and reverting prices...');

    try {
      const response = await fetch('/api/pricing/global-disable', {
        method: 'POST',
      });

      const data = await response.json();

      toast.dismiss(loadingToast);

      if (data.success) {
        setGlobalEnabledState(false);
        setGlobalSnapshots(data.productSnapshots);
        setProductCount(data.count);
        toast.success(`Smart pricing disabled for ${data.count} products`, {
          description: 'All prices reverted to base values',
        });
      } else {
        toast.error('Failed to disable smart pricing globally');
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('An error occurred');
      console.error(error);
    } finally {
      setIsLoadingGlobal(false);
      setPendingGlobalAction(null);
    }
  };

  // Confirm global enable - show resume modal
  const confirmGlobalEnable = () => {
    setShowGlobalConfirm(false);
    // For now, use placeholder prices - in production you'd fetch these from products
    setGlobalPriceOptions({ base: 50, last: 65 });
    setShowGlobalResumeModal(true);
  };

  // Confirm global resume with option
  const confirmGlobalResume = async (option: ResumeOption) => {
    setIsLoadingGlobal(true);
    setShowGlobalResumeModal(false);

    // Show loading toast
    const optionText = option === 'base' ? 'base prices' : 'last smart prices';
    const loadingToast = toast.loading(`Enabling smart pricing and updating to ${optionText}...`);

    try {
      const response = await fetch('/api/pricing/global-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeOption: option }),
      });

      const data = await response.json();

      toast.dismiss(loadingToast);

      if (data.success) {
        setGlobalEnabledState(true);
        setGlobalSnapshots(data.productSnapshots);
        toast.success(`Smart pricing enabled for ${data.count} products`, {
          description: `Starting from ${optionText}`,
        });
      } else {
        toast.error('Failed to enable smart pricing globally');
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('An error occurred');
      console.error(error);
    } finally {
      setIsLoadingGlobal(false);
      setPendingGlobalAction(null);
    }
  };

  // Legacy method for backward compatibility
  const setGlobalEnabled = async (enabled: boolean) => {
    handleGlobalToggle(!enabled);
  };

  const setProductState = (productId: string, enabled: boolean) => {
    setProductStates(prev => {
      const newMap = new Map(prev);
      newMap.set(productId, enabled);
      return newMap;
    });
  };

  const setMultipleProductStates = (productIds: string[], enabled: boolean) => {
    setProductStates(prev => {
      const newMap = new Map(prev);
      productIds.forEach(id => newMap.set(id, enabled));
      return newMap;
    });
  };

  const isProductEnabled = (productId: string) => {
    // If global is off, all products are off
    if (!globalEnabled) return false;
    // Otherwise check individual product state (default to true)
    return productStates.get(productId) ?? true;
  };

  return (
    <SmartPricingContext.Provider
      value={{
        globalEnabled,
        setGlobalEnabled,
        handleGlobalToggle,
        confirmGlobalDisable,
        confirmGlobalEnable,
        confirmGlobalResume,
        isLoadingGlobal,
        showGlobalConfirm,
        setShowGlobalConfirm,
        showGlobalResumeModal,
        setShowGlobalResumeModal,
        pendingGlobalAction,
        globalPriceOptions,
        productStates,
        setProductState,
        setMultipleProductStates,
        isProductEnabled,
        globalSnapshots,
        setGlobalSnapshots,
      }}
    >
      {children}
    </SmartPricingContext.Provider>
  );
}

export function useSmartPricing() {
  const context = useContext(SmartPricingContext);
  if (!context) {
    throw new Error('useSmartPricing must be used within SmartPricingProvider');
  }
  return context;
}

