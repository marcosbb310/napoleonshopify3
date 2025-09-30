// Product card component for grid view
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { TrendingUp, TrendingDown, Check, X, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
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
}

export function ProductCard({ product, isSelected, onSelect, onUpdatePricing, onDelete, selectedTags, onTagClick, onShowVariants, isShowingVariants }: ProductCardProps) {
  const [editingField, setEditingField] = useState<'basePrice' | 'cost' | 'maxPrice' | 'currentPrice' | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const profitChange = product.pricing.currentPrice - product.pricing.basePrice;
  const profitChangePercent = ((profitChange / product.pricing.basePrice) * 100).toFixed(1);
  const totalInventory = product.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0);
  const priceRange = product.variants.length > 1 
    ? `$${Math.min(...product.variants.map(v => parseFloat(v.price))).toFixed(2)} - $${Math.max(...product.variants.map(v => parseFloat(v.price))).toFixed(2)}`
    : `$${product.variants[0]?.price || '0.00'}`;

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
    <Card className={`group relative overflow-hidden transition-all ${
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

      {onDelete && (
        <div className="absolute right-3 top-3 z-20">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-md bg-background/95 backdrop-blur-sm shadow-md border hover:border-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(product.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div>
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

        <CardContent className="p-4">
          <div className="space-y-3">
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
            </div>

            {/* Current Price & Performance */}
            <div className="flex items-baseline justify-between bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-2.5 border border-primary/20">
              <div>
                {editingField === 'currentPrice' ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      className="h-8 w-24 text-lg font-bold"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit}>
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleStartEdit('currentPrice', product.pricing.currentPrice, e)}
                    className="text-2xl font-bold tracking-tight text-primary hover:text-white hover:bg-primary transition-all duration-200 cursor-pointer px-2 py-1 rounded-md"
                  >
                    ${product.pricing.currentPrice.toFixed(2)}
                  </button>
                )}
                <div className="text-xs text-muted-foreground">
                  Current
                </div>
              </div>
              <div className="text-right">
                <div className={`flex items-center gap-1 text-sm font-semibold ${profitChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {profitChange >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  <span>{profitChangePercent}%</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {product.pricing.profitMargin.toFixed(1)}% margin
                </div>
              </div>
            </div>

            {/* Tags */}
            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {product.tags.map((tag) => {
                  const isTagSelected = selectedTags?.has(tag);
                  return (
                    <Badge
                      key={tag}
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTagClick?.(tag);
                      }}
                      className={`text-xs font-normal py-0 cursor-pointer transition-all duration-200 ${
                        isTagSelected
                          ? 'bg-purple-500 text-white border-purple-500 hover:bg-purple-600'
                          : 'bg-white text-foreground border-border hover:bg-muted hover:border-primary'
                      }`}
                    >
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            )}

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
                    onClick={(e) => handleStartEdit('basePrice', product.pricing.basePrice, e)}
                    className="text-sm font-bold text-foreground hover:text-white hover:bg-primary transition-all duration-200 cursor-pointer px-2.5 py-1 rounded-md"
                  >
                    ${product.pricing.basePrice.toFixed(2)}
                  </button>
                )}
              </div>

              {/* Cost */}
              <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50 transition-colors">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost</span>
                {editingField === 'cost' ? (
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
                    onClick={(e) => handleStartEdit('cost', product.pricing.cost, e)}
                    className="text-sm font-bold text-foreground hover:text-white hover:bg-primary transition-all duration-200 cursor-pointer px-2.5 py-1 rounded-md"
                  >
                    ${product.pricing.cost.toFixed(2)}
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
                    onClick={(e) => handleStartEdit('maxPrice', product.pricing.maxPrice, e)}
                    className="text-sm font-bold text-foreground hover:text-white hover:bg-primary transition-all duration-200 cursor-pointer px-2.5 py-1 rounded-md"
                  >
                    ${product.pricing.maxPrice.toFixed(2)}
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
