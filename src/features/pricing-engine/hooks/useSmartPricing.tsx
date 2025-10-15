// Smart pricing state management hook
'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { ProductSnapshot, ResumeOption } from '../types';
import { useGlobalDisable, useGlobalResume } from './useSmartPricingMutations';

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
  const [productStates, setProductStates] = useState<Map<string, boolean>>(new Map());
  const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);
  const [showGlobalResumeModal, setShowGlobalResumeModal] = useState(false);
  const [pendingGlobalAction, setPendingGlobalAction] = useState<'enable' | 'disable' | null>(null);
  const [globalPriceOptions, setGlobalPriceOptions] = useState<{ base: number; last: number } | null>(null);
  const [globalSnapshots, setGlobalSnapshots] = useState<ProductSnapshot[] | null>(null);
  const [productCount, setProductCount] = useState(0);

  // React Query mutations
  const globalDisableMutation = useGlobalDisable();
  const globalResumeMutation = useGlobalResume();
  
  // Extract ONLY the isPending boolean values to break mutation object reference
  const isDisablePending = globalDisableMutation.isPending;
  const isResumePending = globalResumeMutation.isPending;
  
  // Loading state from mutations - using extracted booleans
  const isLoadingGlobal = isDisablePending || isResumePending;

  // Handle global toggle click - memoized to prevent re-renders
  const handleGlobalToggle = useCallback((currentEnabled: boolean) => {
    setPendingGlobalAction(currentEnabled ? 'disable' : 'enable');
    setShowGlobalConfirm(true);
  }, []);

  // Confirm global disable - memoized to prevent re-renders
  const confirmGlobalDisable = useCallback(async () => {
    setShowGlobalConfirm(false);

    // Show loading toast
    const loadingToast = toast.loading('Disabling smart pricing and reverting prices...');

    try {
      const data = await globalDisableMutation.mutateAsync();

      toast.dismiss(loadingToast);

      setGlobalEnabledState(false);
      setGlobalSnapshots(data.productSnapshots);
      setProductCount(data.count);
      toast.success(`Smart pricing disabled for ${data.count} products`, {
        description: 'All prices reverted to base values',
      });
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
      console.error(error);
    } finally {
      setPendingGlobalAction(null);
    }
  }, []); // Empty deps - mutation object is stable enough for our needs

  // Confirm global enable - show resume modal - memoized to prevent re-renders
  const confirmGlobalEnable = useCallback(() => {
    setShowGlobalConfirm(false);
    // For now, use placeholder prices - in production you'd fetch these from products
    setGlobalPriceOptions({ base: 50, last: 65 });
    setShowGlobalResumeModal(true);
  }, []);

  // Confirm global resume with option - memoized to prevent re-renders
  const confirmGlobalResume = useCallback(async (option: ResumeOption) => {
    setShowGlobalResumeModal(false);

    // Show loading toast
    const optionText = option === 'base' ? 'base prices' : 'last smart prices';
    const loadingToast = toast.loading(`Enabling smart pricing and updating to ${optionText}...`);

    try {
      const data = await globalResumeMutation.mutateAsync({ resumeOption: option });

      toast.dismiss(loadingToast);

      setGlobalEnabledState(true);
      setGlobalSnapshots(data.productSnapshots);
      toast.success(`Smart pricing enabled for ${data.count} products`, {
        description: `Starting from ${optionText}`,
      });
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
      console.error(error);
    } finally {
      setPendingGlobalAction(null);
    }
  }, []); // Empty deps - mutation object is stable enough for our needs

  // Legacy method for backward compatibility - memoized to prevent re-renders
  const setGlobalEnabled = useCallback(async (enabled: boolean) => {
    handleGlobalToggle(!enabled);
  }, []); // Empty deps - handleGlobalToggle is already stable

  const setProductState = useCallback((productId: string, enabled: boolean) => {
    setProductStates(prev => {
      const newMap = new Map(prev);
      newMap.set(productId, enabled);
      return newMap;
    });
  }, []);

  const setMultipleProductStates = useCallback((productIds: string[], enabled: boolean) => {
    setProductStates(prev => {
      const newMap = new Map(prev);
      productIds.forEach(id => newMap.set(id, enabled));
      return newMap;
    });
  }, []);

  const isProductEnabled = useCallback((productId: string) => {
    // If global is off, all products are off
    if (!globalEnabled) return false;
    // Otherwise check individual product state (default to true)
    return productStates.get(productId) ?? true;
  }, [globalEnabled, productStates]);

  // Memoize context value with ONLY truly necessary dependencies
  // Key: exclude functions (they're already memoized) and Maps (cause reference issues)
  const value = useMemo(
    () => ({
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
    }),
    [
      globalEnabled,
      isLoadingGlobal,
      showGlobalConfirm,
      showGlobalResumeModal,
      pendingGlobalAction,
      globalSnapshots,
      // Intentionally exclude: productStates, globalPriceOptions, all callbacks
    ]
  );

  return (
    <SmartPricingContext.Provider value={value}>
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

