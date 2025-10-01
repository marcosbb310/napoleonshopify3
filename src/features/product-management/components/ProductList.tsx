// Product list component for list view
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { TrendingUp, TrendingDown, Edit, Check, X, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ProductWithPricing } from '../types';

interface ProductListProps {
  products: ProductWithPricing[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onEdit: (product: ProductWithPricing) => void;
  onUpdatePricing?: (productId: string, pricing: { basePrice?: number; cost?: number; maxPrice?: number; currentPrice?: number }) => void;
  onDelete?: (productId: string) => void;
  isProductEnabled?: (productId: string) => boolean;
  onSmartPricingToggle?: (productId: string, enabled: boolean) => void;
}

export function ProductList({ 
  products, 
  selectedIds, 
  onSelect, 
  onSelectAll,
  onEdit,
  onUpdatePricing,
  onDelete,
  isProductEnabled,
  onSmartPricingToggle
}: ProductListProps) {
  const allSelected = products.length > 0 && products.every(p => selectedIds.has(p.id));
  const [editingField, setEditingField] = useState<{ productId: string; field: 'currentPrice' | 'basePrice' | 'cost' | 'maxPrice' } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = (productId: string, field: 'currentPrice' | 'basePrice' | 'cost' | 'maxPrice', currentValue: number) => {
    setEditingField({ productId, field });
    setEditValue(currentValue.toFixed(2));
  };

  const handleSaveEdit = () => {
    if (editingField && onUpdatePricing) {
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue) && newValue > 0) {
        onUpdatePricing(editingField.productId, { [editingField.field]: newValue });
      }
    }
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const renderEditablePrice = (product: ProductWithPricing, field: 'currentPrice' | 'basePrice' | 'cost' | 'maxPrice', value: number, className: string = '') => {
    const isEditing = editingField?.productId === product.id && editingField?.field === field;
    
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 w-20 text-sm"
            autoFocus
          />
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit}>
            <Check className="h-3.5 w-3.5 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
            <X className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      );
    }

    return (
      <button
        onClick={() => handleStartEdit(product.id, field, value)}
        className={`hover:bg-primary hover:text-white transition-all duration-200 cursor-pointer px-2 py-1 rounded-md ${className}`}
      >
        ${value.toFixed(2)}
      </button>
    );
  };

  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-3 text-left w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onSelectAll}
                />
              </th>
              <th className="p-3 text-left font-medium">Product</th>
              <th className="p-3 text-left font-medium">Current Price</th>
              <th className="p-3 text-left font-medium">Base Price</th>
              <th className="p-3 text-left font-medium">Cost</th>
              <th className="p-3 text-left font-medium">Max Price</th>
              <th className="p-3 text-left font-medium">Margin</th>
              <th className="p-3 text-left font-medium">Change</th>
              <th className="p-3 text-left font-medium">Tags</th>
              <th className="p-3 text-right font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const profitChange = product.pricing.currentPrice - product.pricing.basePrice;
              const profitChangePercent = ((profitChange / product.pricing.basePrice) * 100).toFixed(1);
              
              // Algorithm status logic (TODO: Replace with real API data)
              const getAlgorithmStatus = () => {
                const margin = product.pricing.profitMargin;
                const priceChange = parseFloat(profitChangePercent);
                
                if (margin < 15 || priceChange < -10) {
                  return { icon: AlertTriangle, label: 'Review', color: 'text-yellow-600' };
                } else if (margin > 30 && priceChange > 10) {
                  return { icon: CheckCircle2, label: 'Optimizing', color: 'text-green-600' };
                } else {
                  return { icon: Activity, label: 'Active', color: 'text-blue-600' };
                }
              };
              
              const algorithmStatus = getAlgorithmStatus();

              return (
                <tr
                  key={product.id}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  <td className="p-3">
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => onSelect(product.id)}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                        {product.images[0] ? (
                          <Image
                            src={product.images[0].src}
                            alt={product.title}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <span className="text-muted-foreground text-xs">No image</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{product.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground truncate">
                            {product.vendor}
                          </span>
                          <Badge variant="outline" className={`text-xs ${algorithmStatus.color}`}>
                            <algorithmStatus.icon className="h-3 w-3 mr-1" />
                            {algorithmStatus.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    {renderEditablePrice(product, 'currentPrice', product.pricing.currentPrice, 'font-semibold')}
                  </td>
                  <td className="p-3">
                    {renderEditablePrice(product, 'basePrice', product.pricing.basePrice, 'text-muted-foreground')}
                  </td>
                  <td className="p-3">
                    {renderEditablePrice(product, 'cost', product.pricing.cost, 'text-muted-foreground')}
                  </td>
                  <td className="p-3">
                    {renderEditablePrice(product, 'maxPrice', product.pricing.maxPrice, 'text-muted-foreground')}
                  </td>
                  <td className="p-3">
                    <span className="font-medium">
                      {product.pricing.profitMargin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {profitChange >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span className={profitChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {profitChangePercent}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {product.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {product.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{product.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(product)}
                        title="View Details"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
