// Square cards on left that expand horizontally to reveal analytics
'use client';

import { useState } from 'react';
import { ProductCardCompact } from './ProductCardCompact';
import type { ProductWithPricing } from '@/features/product-management/types';

interface ProductGridWithPanelProps {
  products: ProductWithPricing[];
  isProductEnabled: (productId: string) => boolean;
  onSmartPricingToggle: (productId: string, enabled: boolean, newPrice?: number) => void;
}

export function ProductGridWithPanel({
  products,
  isProductEnabled,
  onSmartPricingToggle,
}: ProductGridWithPanelProps) {
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  const handleCardClick = (productId: string) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
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

  // Reorder products so expanded cards are always at the top
  const expandedProducts = products.filter(p => selectedProductIds.has(p.id));
  const collapsedProducts = products.filter(p => !selectedProductIds.has(p.id));
  const orderedProducts = [...expandedProducts, ...collapsedProducts];

  return (
    <div 
      className="grid gap-4"
      style={{
        gridTemplateColumns: selectedProductIds.size > 0
          ? '1fr' // Single column when any card is expanded
          : 'repeat(auto-fit, minmax(280px, 300px))', // Multi-column grid when collapsed
        justifyContent: 'center',
      }}
    >
      {orderedProducts.map((product) => {
        const isExpanded = selectedProductIds.has(product.id);
        
        // If this product is expanded, it should span full width
        return (
          <div 
            key={product.id}
            style={{
              gridColumn: isExpanded ? '1 / -1' : 'auto', // Span all columns when expanded
              display: 'flex',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              transition: 'all 1s ease-in-out',
            }}
          >
            <ProductCardCompact
              product={product}
              isExpanded={isExpanded}
              onClick={() => handleCardClick(product.id)}
              smartPricingEnabled={isProductEnabled(product.id)}
              onSmartPricingToggle={(enabled, newPrice) =>
                onSmartPricingToggle(product.id, enabled, newPrice)
              }
            />
          </div>
        );
      })}
    </div>
  );
}

