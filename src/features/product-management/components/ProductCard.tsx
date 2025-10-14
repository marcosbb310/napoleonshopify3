// Product card component for grid view
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { TrendingUp, TrendingDown, Check, X, ChartLine, Activity, CheckCircle2, AlertTriangle, Zap, ChevronDown, ChevronUp } from 'lucide-react';
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
  onSmartPricingToggle?: (enabled: boolean) => void;
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
  onSmartPricingToggle
}: ProductCardProps) {
  const [editingField, setEditingField] = useState<'basePrice' | 'cost' | 'maxPrice' | 'currentPrice' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [historyTimeRange, setHistoryTimeRange] = useState<'1d' | '1w' | '1m' | 'all'>('1m');
  const [selectedVariantId, setSelectedVariantId] = useState<string>(product.variants[0]?.id || '');
  const [selectedOption1, setSelectedOption1] = useState<string>('');
  const [showVariants, setShowVariants] = useState(false);
  
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
    let startDate = new Date();
    
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

  return (
    <Card className={`group relative overflow-hidden transition-all h-full flex flex-col ${
      isShowingVariants 
        ? 'shadow-2xl border-2 border-primary z-50 scale-105' 
        : 'hover:shadow-lg border-2 hover:border-primary/40 hover:shadow-primary/10'
    }`}>
      <div className="absolute left-3 top-3 z-20">
        <div className="rounded-md bg-background/95 backdrop-blur-sm p-1.5 shadow-md border hover:border-primary transition-colors">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect(product.id)}
          />
        </div>
      </div>

      <div className="absolute right-3 top-3 z-20 flex gap-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-md bg-background/95 backdrop-blur-sm shadow-md border hover:border-primary hover:bg-primary/10 hover:text-primary transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setShowPriceHistory(true);
          }}
          title="View Price History"
        >
          <ChartLine className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="relative aspect-[5/3] overflow-hidden bg-gradient-to-br from-muted to-muted/50 z-0">
          {product.images[0] ? (
            <Image
              src={product.images[0].src}
              alt={product.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-102"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-muted-foreground text-sm">No image</span>
            </div>
          )}
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <CardContent className="p-4 flex-1 flex flex-col">
          <div className="space-y-3 flex-1 flex flex-col">
            {/* Title & Vendor */}
            <div className="min-h-[42px]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate mb-0.5 leading-tight">{product.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {product.vendor}
                  </p>
                </div>
                {product.variants.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowVariants?.(product.id);
                    }}
                    className="text-xs text-primary hover:text-primary/80 font-medium whitespace-nowrap transition-colors"
                  >
                    {product.variants.length} variants
                  </button>
                )}
              </div>
              {/* Algorithm Status Badge */}
              <div className="mt-2 flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`text-xs font-normal ${algorithmStatus.color} ${algorithmStatus.bgColor} ${algorithmStatus.borderColor}`}
                >
                  <algorithmStatus.icon className="h-3 w-3 mr-1" />
                  {algorithmStatus.label}
                </Badge>
                <span className="text-xs text-muted-foreground/70">
                  Updated 2h ago
                </span>
              </div>
            </div>

            {/* Last Price Change Badge */}
            <div className="flex items-center justify-between bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-2.5 border border-primary/20">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Last Change</div>
                <div className="text-xl font-bold tracking-tight text-primary">
                  ${product.pricing.basePrice.toFixed(2)} → ${variantPricing.currentPrice.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className={`flex items-center gap-1 text-lg font-bold ${profitChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {profitChange >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span>{parseFloat(profitChangePercent) >= 0 ? '+' : ''}{profitChangePercent}%</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {product.pricing.profitMargin.toFixed(1)}% margin
                </div>
              </div>
            </div>

            {/* Variant Selector - Fixed height for alignment */}
            <div className="min-h-[32px]">
              {variantOptions && variantOptions.option1.length > 0 && (
                <div className="space-y-2">
                  {/* Clickable Variant Toggle */}
                  <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowVariants(!showVariants);
                  }}
                  className="w-full flex items-center justify-between text-xs py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <span className="text-muted-foreground">
                    <span className="font-medium">Variant:</span> {selectedVariant.title}
                  </span>
                  {showVariants ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
                
                {/* Expandable Variant Options */}
                {showVariants && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                    {/* Option 1 (e.g., Color) */}
                    <div className="flex flex-wrap gap-1.5">
                      {variantOptions.option1.map((option) => {
                        const isSelected = selectedOption1 === option;
                        return (
                          <Badge
                            key={option}
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOption1(option);
                              // Find and select the first variant with this option1
                              const variant = product.variants.find(v => v.title.startsWith(option));
                              if (variant) setSelectedVariantId(variant.id);
                            }}
                            className={`text-xs font-normal py-1 px-2.5 cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                                : 'bg-white text-foreground border-border hover:bg-muted hover:border-primary'
                            }`}
                          >
                            {option}
                          </Badge>
                        );
                      })}
                    </div>
                    
                    {/* Option 2 (e.g., Size) - shows when option1 is selected */}
                    {selectedOption1 && variantOptions.option2.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {getAvailableOption2(selectedOption1).map((option) => {
                          const fullTitle = `${selectedOption1} / ${option}`;
                          const variant = product.variants.find(v => v.title === fullTitle);
                          const isSelected = variant?.id === selectedVariantId;
                          
                          return (
                            <Badge
                              key={option}
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (variant) setSelectedVariantId(variant.id);
                              }}
                              className={`text-xs font-normal py-1 px-2.5 cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? 'bg-secondary text-secondary-foreground border-secondary hover:bg-secondary/90'
                                  : 'bg-white text-foreground border-border hover:bg-muted hover:border-secondary'
                              }`}
                            >
                              {option}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                </div>
              )}
            </div>

            {/* Pricing Controls */}
            <div className="space-y-1.5 border-t pt-2">
              {/* Base Price */}
              <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50 transition-colors">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Base</span>
                {editingField === 'basePrice' ? (
                  <div className="flex items-center gap-0.5">
                    <Input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 w-20 text-sm font-semibold"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleStartEdit('basePrice', variantPricing.basePrice, e)}
                    className="text-sm font-bold text-foreground hover:text-white hover:bg-primary transition-all duration-200 cursor-pointer px-2.5 py-1 rounded-md"
                  >
                    ${variantPricing.basePrice.toFixed(2)}
                  </button>
                )}
              </div>

              {/* Current Price */}
              <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50 transition-colors">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current</span>
                {editingField === 'currentPrice' ? (
                  <div className="flex items-center gap-0.5">
                    <Input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 w-20 text-sm font-semibold"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-primary hover:text-white transition-all duration-200" onClick={handleSaveEdit}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive hover:text-white transition-all duration-200" onClick={handleCancelEdit}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleStartEdit('currentPrice', variantPricing.currentPrice, e)}
                    className="text-sm font-bold text-foreground hover:text-white hover:bg-primary transition-all duration-200 cursor-pointer px-2.5 py-1 rounded-md"
                  >
                    ${variantPricing.currentPrice.toFixed(2)}
                  </button>
                )}
              </div>

              {/* Max Price */}
              <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50 transition-colors">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Max</span>
                {editingField === 'maxPrice' ? (
                  <div className="flex items-center gap-0.5">
                    <Input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 w-20 text-sm font-semibold"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-primary hover:text-white transition-all duration-200" onClick={handleSaveEdit}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive hover:text-white transition-all duration-200" onClick={handleCancelEdit}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleStartEdit('maxPrice', variantPricing.maxPrice, e)}
                    className="text-sm font-bold text-foreground hover:text-white hover:bg-primary transition-all duration-200 cursor-pointer px-2.5 py-1 rounded-md"
                  >
                    ${variantPricing.maxPrice.toFixed(2)}
                  </button>
                )}
              </div>
            </div>

            {/* Smart Pricing Toggle - Full Width Button at Bottom */}
            <div className="mt-auto pt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSmartPricingToggle?.(!smartPricingEnabled);
                }}
                className={`w-full px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-all font-semibold ${
                  smartPricingEnabled 
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm' 
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                <Zap className={`h-4 w-4 ${smartPricingEnabled ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                <span className="text-sm">
                  {smartPricingEnabled ? 'Smart Pricing Active' : 'Smart Pricing Off'}
                </span>
              </button>
            </div>
          </div>
        </CardContent>
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
            <Tabs value={historyTimeRange} onValueChange={(value) => setHistoryTimeRange(value as any)}>
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
    </Card>
  );
}
