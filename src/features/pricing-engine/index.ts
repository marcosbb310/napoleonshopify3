// Public API for pricing-engine feature
// Note: pricingAlgorithm is NOT exported here because it's server-side only
// Import it directly in API routes and Trigger.dev tasks:
// import { runPricingAlgorithm } from '@/features/pricing-engine/services/pricingAlgorithm';

export { SmartPricingProvider, useSmartPricing } from './hooks/useSmartPricing';
export { useUndoState } from './hooks/useUndoState';
export { useSmartPricingToggle } from './hooks/useSmartPricingToggle';
export { 
  useGlobalDisable, 
  useGlobalResume, 
  useCreateProduct,
  useUpdatePricingConfig,
  useResumeProduct,
  useUndo 
} from './hooks/useSmartPricingMutations';
export { SmartPricingResumeModal } from './components/SmartPricingResumeModal';
export { SmartPricingConfirmDialog } from './components/SmartPricingConfirmDialog';
export { UndoButton } from './components/UndoButton';
export type { ProductSnapshot, UndoState, UndoActionType, ResumeOption } from './types';
