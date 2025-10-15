// React Query mutations for smart pricing operations
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResumeOption, ProductSnapshot } from '../types';

// ===== Global Disable Mutation =====
interface GlobalDisableResponse {
  success: boolean;
  count: number;
  productSnapshots: ProductSnapshot[];
  error?: string;
}

export function useGlobalDisable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<GlobalDisableResponse> => {
      const response = await fetch('/api/pricing/global-disable', {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to disable smart pricing globally');
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate products query to refetch with updated prices
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ===== Global Resume Mutation =====
interface GlobalResumeRequest {
  resumeOption: ResumeOption;
}

interface GlobalResumeResponse {
  success: boolean;
  count: number;
  resumeOption: ResumeOption;
  productSnapshots: ProductSnapshot[];
  error?: string;
}

export function useGlobalResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ resumeOption }: GlobalResumeRequest): Promise<GlobalResumeResponse> => {
      const response = await fetch('/api/pricing/global-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeOption }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to enable smart pricing globally');
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate products query to refetch with updated prices
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ===== Create Product Mutation =====
interface CreateProductRequest {
  title: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: string;
  variants: Array<{
    title: string;
    price: string;
    compareAtPrice: string;
    sku: string;
    inventoryQuantity: number;
    weight: number;
    weightUnit: string;
  }>;
  images: Array<{
    src: string;
    alt: string;
  }>;
}

interface CreateProductResponse {
  success: boolean;
  data?: any;
  error?: {
    message: string;
  };
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: CreateProductRequest): Promise<CreateProductResponse> => {
      const response = await fetch('/api/shopify/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to create product');
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate products query to refetch and show new product
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ===== Individual Product Pricing Mutations =====
interface UpdatePricingConfigRequest {
  productId: string;
  auto_pricing_enabled: boolean;
}

interface UpdatePricingConfigResponse {
  success: boolean;
  reverted?: boolean;
  revertedTo?: number;
  snapshot?: ProductSnapshot;
  showModal?: boolean;
  preSmart?: number;
  lastSmart?: number;
  price?: number;
  error?: string;
}

export function useUpdatePricingConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, auto_pricing_enabled }: UpdatePricingConfigRequest): Promise<UpdatePricingConfigResponse> => {
      const response = await fetch(`/api/pricing/config/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_pricing_enabled }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update pricing config');
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate products query to refetch with updated config
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ===== Resume Individual Product Mutation =====
interface ResumeProductRequest {
  productId: string;
  resumeOption: ResumeOption;
}

interface ResumeProductResponse {
  success: boolean;
  price: number;
  snapshot?: ProductSnapshot;
  error?: string;
}

export function useResumeProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, resumeOption }: ResumeProductRequest): Promise<ResumeProductResponse> => {
      const response = await fetch('/api/pricing/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, resumeOption }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to resume smart pricing');
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate products query to refetch with updated prices
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ===== Undo Mutation =====
interface UndoRequest {
  productSnapshots: ProductSnapshot[];
}

interface UndoResponse {
  success: boolean;
  count?: number;
  error?: string;
}

export function useUndo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productSnapshots }: UndoRequest): Promise<UndoResponse> => {
      const response = await fetch('/api/pricing/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productSnapshots }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to undo');
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate products query to refetch with undone changes
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

