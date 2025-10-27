// EXPERIMENTAL PAGE - Testing horizontal slide-out layout
// Square product cards with details panel sliding from right
// Can be safely deleted if not preferred
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  useProducts, 
  type ProductFilter, 
  type ProductWithPricing,
} from '@/features/product-management';
import { 
  useSmartPricing, 
} from '@/features/pricing-engine';
import { ProductGridWithPanel } from '@/features/product-management/components-test2';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Zap, Search, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductsTest2Page() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ProductFilter>({
    sortBy: 'title',
    sortDirection: 'asc',
  });

  // Get all products
  const { products: allProducts, loading, error } = useProducts();

  // Smart pricing hook
  const { 
    isProductEnabled, 
    setProductState, 
  } = useSmartPricing();

  const [productUpdates, setProductUpdates] = useState<Map<string, Partial<ProductWithPricing['pricing']>>>(new Map());

  // Add custom keyframe animations - only once on mount
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.head.querySelector('style[data-slide-animations]')) {
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      style.setAttribute('data-slide-animations', 'true');
      document.head.appendChild(style);
    }
  }, []);

  // Apply any pending updates to products
  const applyUpdatesToProducts = (productList: ProductWithPricing[]) => {
    if (productUpdates.size === 0) return productList;
    
    return productList.map(product => {
      const updates = productUpdates.get(product.id);
      if (!updates) return product;
      
      const updatedPricing = { ...product.pricing, ...updates };
      
      // Recalculate profit margin
      const cost = updatedPricing.cost;
      const basePrice = updatedPricing.basePrice;
      updatedPricing.profitMargin = ((basePrice - cost) / basePrice) * 100;
      
      return {
        ...product,
        pricing: updatedPricing,
      };
    });
  };


  // Filter and search products - compute on every render instead of useEffect to avoid Map reference issues
  const products = (() => {
    let filtered = applyUpdatesToProducts([...allProducts]);

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product => {
        const title = product.title.toLowerCase();
        const vendor = product.vendor.toLowerCase();
        const productType = product.productType.toLowerCase();
        
        return title.includes(query) || 
               vendor.includes(query) || 
               productType.includes(query) ||
               product.tags.some(tag => tag.toLowerCase().includes(query));
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filter.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'price':
          comparison = a.pricing.currentPrice - b.pricing.currentPrice;
          break;
        case 'updated':
          comparison = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          break;
      }

      return filter.sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  })();

  const handleProductSmartPricingToggle = (productId: string, enabled: boolean, newPrice?: number) => {
    setProductState(productId, enabled);

    // Update product price if provided
    if (newPrice !== undefined) {
      setProductUpdates(prev => {
        const newMap = new Map(prev);
        const existingUpdates = newMap.get(productId) || {};
        newMap.set(productId, { ...existingUpdates, currentPrice: newPrice });
        return newMap;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/products')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Products (Horizontal Slide-out)</h1>
            <Badge variant="secondary" className="text-xs">
              🧪 TEST VERSION 2
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Square cards with horizontal panel sliding from the right
          </p>
        </div>
      </div>

      {/* Alert Banner */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-100">
              This is test version 2 - Horizontal slide-out layout
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Click on any product card to slide out a details panel from the right. 
              Cards show only image and name for a clean, visual browsing experience.
              Compare with <Button variant="link" className="h-auto p-0 text-blue-600" onClick={() => router.push('/products-test')}>Version 1 (Vertical Accordion)</Button>
            </p>
          </div>
        </div>
      </Card>

      {/* Global Controls */}
      <div className="flex items-center justify-end gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Products Count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing <span className="font-semibold text-foreground">{products.length}</span> of{' '}
          <span className="font-semibold text-foreground">{allProducts.length}</span> products
        </p>
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
          >
            Clear search
          </Button>
        )}
      </div>

      {/* Product Grid with Panel */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="aspect-square animate-pulse bg-muted" />
          ))}
        </div>
      ) : error ? (
        <Card className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-destructive">Failed to load products</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
          </div>
        </Card>
      ) : (
        <ProductGridWithPanel
          products={products}
          isProductEnabled={isProductEnabled}
          onSmartPricingToggle={handleProductSmartPricingToggle}
        />
      )}

    </div>
  );
}

