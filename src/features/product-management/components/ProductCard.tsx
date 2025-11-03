// Product card component for grid view
// 
// ⚠️ OPTION 2 LAYOUT ACTIVE - Minimal Card (Easy to Undo)
// To revert to the original detailed layout, search for "OPTION 2" comments
// and uncomment the sections while removing the new "Current Price - Now Prominent" section
//
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { TrendingUp, TrendingDown, Check, X, ChartLine, Activity, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useSmartPricingToggle, SmartPricingConfirmDialog, SmartPricingResumeModal } from '@/features/pricing-engine';
import type { ProductWithPricing } from '../types';

interface ProductCardProps {
  product: ProductWithPricing;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (product: ProductWithPricing) => void;
  onUpdatePricing?: (productId: string, pricing: { basePrice?: number; cost?: number; maxPrice?: number; currentPrice?: number }) => void;
  onDelete?: (productId: string) => void;
  selectedTags?: Set<string>;
  onTagClick?: (tag: string) => void;
  onShowVariants?: (productId: string) => void;
  isShowingVariants?: boolean;
  smartPricingEnabled?: boolean;
  onSmartPricingToggle?: (enabled: boolean, newPrice?: number) => void;
  onViewAnalytics?: (productId: string) => void;
  hasAnySelection?: boolean;
  testBackgroundColor?: string; // TEMPORARY: For testing visibility (e.g., "white", "black", "#ff0000")
  globalSmartPricingEnabled?: boolean; // NEW: Pass global state as prop to avoid circular dependency
}

export function ProductCard({ 
  product, 
  isSelected, 
  onSelect, 
  onUpdatePricing, 
  onDelete, 
  selectedTags, 
  onTagClick, 
  onShowVariants, 
  isShowingVariants,
  smartPricingEnabled = true,
  onSmartPricingToggle,
  onViewAnalytics,
  hasAnySelection = false,
  testBackgroundColor,
  globalSmartPricingEnabled = true
}: ProductCardProps) {
  const [editingField, setEditingField] = useState<'basePrice' | 'cost' | 'maxPrice' | 'currentPrice' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [historyTimeRange, setHistoryTimeRange] = useState<'1d' | '1w' | '1m' | 'all'>('1m');
  const [selectedVariantId, setSelectedVariantId] = useState<string>(product.variants[0]?.id || '');
  const [selectedOption1, setSelectedOption1] = useState<string>('');
  const [showVariants, setShowVariants] = useState(false);
  
  // Track local enabled state for immediate UI feedback
  const [localEnabled, setLocalEnabled] = useState(smartPricingEnabled);
  
  // Sync local state with prop changes
  useEffect(() => {
    setLocalEnabled(smartPricingEnabled);
  }, [smartPricingEnabled]);
  
  // Use smart pricing toggle hook
  const {
    isLoading: isTogglingSmartPricing,
    showConfirm,
    setShowConfirm,
    showResumeModal,
    setShowResumeModal,
    pendingAction,
    priceOptions,
    handleToggle,
    handleConfirmToggle,
    handleResumeConfirm,
  } = useSmartPricingToggle({
    productId: product.id,
    productName: product.title,
  });
  
  const profitChange = product.pricing.currentPrice - product.pricing.basePrice;
  const profitChangePercent = ((profitChange / product.pricing.basePrice) * 100).toFixed(1);
  const totalInventory = product.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0);
  const priceRange = product.variants.length > 1 
    ? `$${Math.min(...product.variants.map(v => parseFloat(v.price))).toFixed(2)} - $${Math.max(...product.variants.map(v => parseFloat(v.price))).toFixed(2)}`
    : `$${product.variants[0]?.price || '0.00'}`;

  // Parse variant options from variant titles (e.g., "Red / Large" -> {color: "Red", size: "Large"})
  const parseVariantOptions = () => {
    if (product.variants.length === 1) return null;
    
    const options: { option1: Set<string>, option2: Set<string> } = {
      option1: new Set(),
      option2: new Set()
    };
    
    product.variants.forEach(variant => {
      const parts = variant.title.split(' / ').map(p => p.trim());
      if (parts[0] && parts[0] !== 'Default Title') options.option1.add(parts[0]);
      if (parts[1]) options.option2.add(parts[1]);
    });
    
    return {
      option1: Array.from(options.option1),
      option2: Array.from(options.option2)
    };
  };

  const variantOptions = parseVariantOptions();
  
  // Get available option2 values based on selected option1
  const getAvailableOption2 = (option1Value: string) => {
    if (!variantOptions || !variantOptions.option2.length) return [];
    
    return product.variants
      .filter(v => v.title.startsWith(option1Value))
      .map(v => v.title.split(' / ')[1]?.trim())
      .filter(Boolean);
  };
  
  // Get selected variant for pricing
  const selectedVariant = product.variants.find(v => v.id === selectedVariantId) || product.variants[0];
  
  // Use actual product pricing (TODO: In future, each variant should have its own pricing)
  // For now, all variants share the same pricing settings
  const variantPricing = product.pricing;

  // Algorithm status logic (TODO: Replace with real API data)
  const getAlgorithmStatus = () => {
    // Simulate algorithm status based on profit margin
    const margin = product.pricing.profitMargin;
    const priceChange = parseFloat(profitChangePercent);
    
    if (margin < 15 || priceChange < -10) {
      return {
        status: 'warning' as const,
        label: 'Needs Review',
        icon: AlertTriangle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100 dark:bg-yellow-950',
        borderColor: 'border-yellow-200 dark:border-yellow-900'
      };
    } else if (margin > 30 && priceChange > 10) {
      return {
        status: 'success' as const,
        label: 'Auto Optimizing',
        icon: CheckCircle2,
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-950',
        borderColor: 'border-green-200 dark:border-green-900'
      };
    } else {
      return {
        status: 'active' as const,
        label: 'Auto Pricing',
        icon: Activity,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100 dark:bg-blue-950',
        borderColor: 'border-blue-200 dark:border-blue-900'
      };
    }
  };

  const algorithmStatus = getAlgorithmStatus();

  // Sample price history data (would come from API in production)
  const generatePriceHistory = () => {
    const history = [];
    const currentPrice = product.pricing.currentPrice;
    const now = new Date();
    
    // Generate daily data for last 30 days
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Simulate price variations
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
      const price = currentPrice * (1 + variation);
      const sales = Math.floor(Math.random() * 50) + 10;
      
      history.push({
        date: date.toISOString().split('T')[0],
        price: parseFloat(price.toFixed(2)),
        sales,
        revenue: parseFloat((price * sales).toFixed(2)),
      });
    }
    
    return history;
  };

  const priceHistory = generatePriceHistory();

  // Filter history based on time range
  const getFilteredHistory = () => {
    const now = new Date();
    const startDate = new Date();
    
    switch (historyTimeRange) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '1w':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1m':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'all':
        return priceHistory;
    }
    
    return priceHistory.filter(entry => new Date(entry.date) >= startDate);
  };

  const filteredHistory = getFilteredHistory();

  const handleStartEdit = (field: 'basePrice' | 'cost' | 'maxPrice' | 'currentPrice', currentValue: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingField(field);
    setEditValue(currentValue.toFixed(2));
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingField && onUpdatePricing) {
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue) && newValue > 0) {
        onUpdatePricing(product.id, { [editingField]: newValue });
      }
    }
    setEditingField(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue) && newValue > 0 && editingField && onUpdatePricing) {
        onUpdatePricing(product.id, { [editingField]: newValue });
      }
      setEditingField(null);
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Open analytics panel
    if (onViewAnalytics) {
      onViewAnalytics(product.id);
    }
  };

  return (
    <Card 
      data-product-id={product.id}
      className={`group relative overflow-hidden transition-all aspect-square cursor-pointer hover:scale-[1.02] ${
        isSelected
          ? 'border-4 border-primary shadow-2xl opacity-100' 
          : isShowingVariants 
          ? 'shadow-2xl border-2 border-primary z-50 scale-105' 
          : hasAnySelection
          ? 'opacity-40 hover:opacity-60 border-2 hover:border-primary/40'
          : 'hover:shadow-lg border-2 hover:border-primary/40 hover:shadow-primary/10'
      }`}
    >
      
      {/* Full Background Image */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {testBackgroundColor ? (
          // TEMPORARY TEST: Solid color background for testing visibility
          <div className="h-full w-full" style={{ backgroundColor: testBackgroundColor }} />
        ) : product.images[0] ? (
          <Image
            src={product.images[0].src}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <span className="text-muted-foreground text-sm">No image</span>
          </div>
        )}
        {/* Stronger gradient overlay for guaranteed text readability - SKIP for test colors to see visibility */}
        {!testBackgroundColor && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/75 pointer-events-none" />
        )}
      </div>

      {/* Content Overlay - visual content only */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none flex flex-col p-3"
      >
        {/* Top Section - Title */}
        <div className="flex-shrink-0">
          <div className="p-2 pl-10">
            <h3 className="font-semibold text-sm truncate leading-tight text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.8)' }}>{product.title}</h3>
          </div>
        </div>

        {/* Spacer to push content to bottom */}
        <div className="flex-1" />

        {/* Bottom Section - Price */}
        <div className="flex-shrink-0 pb-20">
          <div className="p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-white" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)' }}>
                ${variantPricing.currentPrice.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clickable Overlay - z-20, sits between content (z-10) and buttons (z-30) */}
      <div 
        className="absolute inset-0 z-20 cursor-pointer"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => {
          // Ignore clicks on interactive elements (button or checkbox)
          const target = e.target as HTMLElement;
          const clickedButton = target.closest('button');
          const clickedCheckbox = target.closest('[data-checkbox]');
          
          if (clickedButton || clickedCheckbox) {
            return;
          }
          
          // Open analytics panel
          handleCardClick(e);
        }}
        aria-hidden="true"
      />

      {/* Buttons - positioned absolutely to be above click overlay */}
      <div 
        className="absolute bottom-3 left-3 right-3 z-30 space-y-1.5"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(localEnabled);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={isTogglingSmartPricing}
          className={`relative w-full px-3 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-md shadow-lg ${
            localEnabled 
              ? 'bg-white/90 hover:bg-white text-gray-900 animate-pulse-subtle' 
              : 'bg-black/60 hover:bg-black/70 text-white'
          }`}
        >
          {/* Active glow effect */}
          {localEnabled && (
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-blue-500/20 animate-glow-pulse" />
          )}
          <Zap className={`h-3.5 w-3.5 relative z-10 ${
            localEnabled 
              ? 'text-primary animate-pulse' 
              : 'text-white'
          }`} />
          <span className="text-xs relative z-10">
            {isTogglingSmartPricing 
              ? 'Updating...' 
              : localEnabled ? 'Smart Pricing Active' : 'Smart Pricing Off'}
          </span>
        </button>
      </div>

      {/* Checkbox - Top Left */}
      <div 
        className="absolute left-3 top-3 z-50"
        data-checkbox="true"
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onSelect(product.id);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
          isSelected 
            ? 'bg-primary border-primary' 
            : 'bg-white/80 border-gray-300 hover:border-primary'
        }`}>
          {isSelected && (
            <Check className="h-4 w-4 text-white" />
          )}
        </div>
      </div>

      {/* Price History Dialog */}
      <Dialog open={showPriceHistory} onOpenChange={setShowPriceHistory}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChartLine className="h-5 w-5" />
              Price History - {product.title}
            </DialogTitle>
            <DialogDescription>
              View historical pricing data and sales performance
            </DialogDescription>
          </DialogHeader>

          {/* Time Range Selector */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              Showing {filteredHistory.length} entries
            </div>
            <Tabs value={historyTimeRange} onValueChange={(value) => setHistoryTimeRange(value as '1d' | '1w' | '1m' | 'all')}>
              <TabsList>
                <TabsTrigger value="1d">1 Day</TabsTrigger>
                <TabsTrigger value="1w">1 Week</TabsTrigger>
                <TabsTrigger value="1m">1 Month</TabsTrigger>
                <TabsTrigger value="all">All Time</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Price History Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr className="text-sm">
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-right py-3 px-4 font-medium">Price</th>
                    <th className="text-right py-3 px-4 font-medium">Change</th>
                    <th className="text-right py-3 px-4 font-medium">Sales</th>
                    <th className="text-right py-3 px-4 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((entry, index) => {
                    const prevEntry = index > 0 ? filteredHistory[index - 1] : null;
                    const priceChange = prevEntry 
                      ? ((entry.price - prevEntry.price) / prevEntry.price) * 100 
                      : 0;
                    
                    return (
                      <tr key={entry.date} className="border-t text-sm hover:bg-muted/50">
                        <td className="py-3 px-4">
                          {new Date(entry.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: historyTimeRange === 'all' ? 'numeric' : undefined
                          })}
                        </td>
                        <td className="text-right py-3 px-4 font-medium">
                          ${entry.price.toFixed(2)}
                        </td>
                        <td className="text-right py-3 px-4">
                          {prevEntry && priceChange !== 0 ? (
                            <span className={priceChange > 0 ? 'text-green-600' : 'text-red-600'}>
                              {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="text-right py-3 px-4">{entry.sales}</td>
                        <td className="text-right py-3 px-4 font-medium">
                          ${entry.revenue.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Average Price</p>
              <p className="text-lg font-semibold">
                ${(filteredHistory.reduce((sum, h) => sum + h.price, 0) / filteredHistory.length).toFixed(2)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Total Sales</p>
              <p className="text-lg font-semibold">
                {filteredHistory.reduce((sum, h) => sum + h.sales, 0)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
              <p className="text-lg font-semibold">
                ${filteredHistory.reduce((sum, h) => sum + h.revenue, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Pricing Confirmation Dialog - Only for disable */}
      <SmartPricingConfirmDialog
        open={showConfirm && pendingAction === 'disable'}
        onOpenChange={setShowConfirm}
        onConfirm={async () => {
          const result = await handleConfirmToggle();
          // Update local state immediately for instant UI feedback
          setLocalEnabled(false);
          // Update parent state with new price immediately for smooth UX
          if (result?.revertedTo !== undefined) {
            onSmartPricingToggle?.(false, result.revertedTo);
          }
        }}
        type="disable"
        productName={product.title}
      />

      {/* Smart Pricing Resume Modal */}
      <SmartPricingResumeModal
        open={showResumeModal}
        onOpenChange={setShowResumeModal}
        onConfirm={async (option) => {
          const result = await handleResumeConfirm(option);
          // Update local state immediately for instant UI feedback
          setLocalEnabled(true);
          // Update parent state with new price immediately for smooth UX
          if (result?.price !== undefined) {
            onSmartPricingToggle?.(true, result.price);
          } else {
            onSmartPricingToggle?.(true);
          }
        }}
        productCount={1}
        basePrice={priceOptions?.base || 0}
        lastSmartPrice={priceOptions?.last || 0}
      />
    </Card>
  );
}
