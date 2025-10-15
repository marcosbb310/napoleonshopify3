// Experimental accordion list container - manages expansion state
'use client';

import { useState } from 'react';
import { ProductAccordionRow } from './ProductAccordionRow';
import type { ProductWithPricing } from '@/features/product-management/types';

interface ProductAccordionListProps {
  products: ProductWithPricing[];
  isProductEnabled: (productId: string) => boolean;
  onSmartPricingToggle: (productId: string, enabled: boolean, newPrice?: number) => void;
}

export function ProductAccordionList({
  products,
  isProductEnabled,
  onSmartPricingToggle,
}: ProductAccordionListProps) {
  // Only allow one product to be expanded at a time
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const handleToggleExpand = (productId: string) => {
    setExpandedProductId(prev => prev === productId ? null : productId);
  };

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">No products found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {products.map((product) => (
        <ProductAccordionRow
          key={product.id}
          product={product}
          isExpanded={expandedProductId === product.id}
          onToggleExpand={() => handleToggleExpand(product.id)}
          smartPricingEnabled={isProductEnabled(product.id)}
          onSmartPricingToggle={(enabled, newPrice) => 
            onSmartPricingToggle(product.id, enabled, newPrice)
          }
        />
      ))}
    </div>
  );
}

