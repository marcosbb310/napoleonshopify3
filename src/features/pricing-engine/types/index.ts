// Pricing engine types

export interface PricingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: PricingCondition[];
  action: PriceAdjustment;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingCondition {
  type: 'time_of_day' | 'day_of_week' | 'holiday' | 'demand' | 'inventory';
  operator: 'equals' | 'greater_than' | 'less_than' | 'between';
  value: string | number | [number, number];
}

export interface PriceAdjustment {
  type: 'percentage' | 'fixed';
  value: number;
  min?: number;
  max?: number;
}

export interface PricingHistory {
  productId: string;
  variantId: string;
  oldPrice: number;
  newPrice: number;
  reason: string;
  appliedRule?: string;
  timestamp: Date;
}

export interface PricingStrategy {
  id: string;
  name: string;
  description: string;
  rules: PricingRule[];
  enabled: boolean;
}

// Smart pricing toggle types
export interface ProductSnapshot {
  productId: string;
  shopifyId: string;
  price: number; // Old price (for undo)
  newPrice?: number; // New price (for UI update) - optional for backward compatibility
  auto_pricing_enabled: boolean;
  current_state?: string;
  next_price_change_date?: string | null;
  revert_wait_until_date?: string | null;
}

export type UndoActionType = 'global-on' | 'global-off' | 'individual-on' | 'individual-off';

export interface UndoState {
  action: UndoActionType;
  timestamp: number;
  productSnapshots: ProductSnapshot[];
  description: string;
}

export type ResumeOption = 'base' | 'last';
