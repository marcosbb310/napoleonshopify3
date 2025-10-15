// Hook to manage undo state for smart pricing toggles
'use client';

import { useState, useEffect, useCallback } from 'react';
import { UndoState, ProductSnapshot, UndoActionType } from '../types';
import { useUndo } from './useSmartPricingMutations';

const UNDO_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const UNDO_STORAGE_KEY = 'smart_pricing_undo_state';

export function useUndoState() {
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  
  // React Query mutation
  const undoMutation = useUndo();

  // Load undo state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(UNDO_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UndoState;
        const elapsed = Date.now() - parsed.timestamp;
        
        // Only restore if still within 10-minute window
        if (elapsed < UNDO_DURATION_MS) {
          setUndoState(parsed);
        } else {
          // Expired, clean up
          localStorage.removeItem(UNDO_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load undo state:', error);
      localStorage.removeItem(UNDO_STORAGE_KEY);
    }
  }, []);

  // Update time remaining every second
  useEffect(() => {
    if (!undoState) {
      setTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - undoState.timestamp;
      const remaining = Math.max(0, UNDO_DURATION_MS - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setUndoState(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [undoState]);

  const setUndo = useCallback((
    action: UndoActionType,
    productSnapshots: ProductSnapshot[],
    description: string
  ) => {
    const newState = {
      action,
      timestamp: Date.now(),
      productSnapshots,
      description,
    };
    setUndoState(newState);
    
    // Persist to localStorage
    try {
      localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.error('Failed to save undo state:', error);
    }
  }, []);

  const clearUndo = useCallback(() => {
    setUndoState(null);
    setTimeRemaining(0);
    
    // Clear from localStorage
    try {
      localStorage.removeItem(UNDO_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear undo state:', error);
    }
  }, []);

  const executeUndo = useCallback(async () => {
    if (!undoState) return { success: false, error: 'No undo state' };

    try {
      const data = await undoMutation.mutateAsync({
        productSnapshots: undoState.productSnapshots,
      });

      if (data.success) {
        clearUndo();
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to undo',
      };
    }
  }, [undoState, clearUndo, undoMutation]);

  const canUndo = undoState !== null && timeRemaining > 0;

  const formatTimeRemaining = useCallback(() => {
    if (timeRemaining === 0) return '';
    
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeRemaining]);

  return {
    undoState,
    canUndo,
    timeRemaining,
    formatTimeRemaining,
    setUndo,
    clearUndo,
    executeUndo,
  };
}

