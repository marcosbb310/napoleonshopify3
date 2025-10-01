// Smart pricing state management hook
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type ReactNode = React.ReactNode;

interface SmartPricingContextType {
  globalEnabled: boolean;
  setGlobalEnabled: (enabled: boolean) => void;
  productStates: Map<string, boolean>;
  setProductState: (productId: string, enabled: boolean) => void;
  setMultipleProductStates: (productIds: string[], enabled: boolean) => void;
  isProductEnabled: (productId: string) => boolean;
}

const SmartPricingContext = createContext<SmartPricingContextType | undefined>(undefined);

export function SmartPricingProvider({ children }: { children: ReactNode }) {
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [productStates, setProductStates] = useState<Map<string, boolean>>(new Map());

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('smartPricingGlobal');
    if (saved !== null) {
      setGlobalEnabled(JSON.parse(saved));
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('smartPricingGlobal', JSON.stringify(globalEnabled));
  }, [globalEnabled]);

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
        productStates,
        setProductState,
        setMultipleProductStates,
        isProductEnabled,
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

