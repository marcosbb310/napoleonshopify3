// Square card that expands horizontally to reveal analytics
'use client';

import { useState } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Package, Zap, ChevronRight, DollarSign, ShoppingCart, TrendingUp, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductWithPricing } from '@/features/product-management/types';
import Image from 'next/image';

interface ProductCardCompactProps {
  product: ProductWithPricing;
  isExpanded: boolean;
  onClick: () => void;
  smartPricingEnabled: boolean;
  onSmartPricingToggle: (enabled: boolean, newPrice?: number) => void;
}

export function ProductCardCompact({
  product,
  isExpanded,
  onClick,
  smartPricingEnabled,
  onSmartPricingToggle,
}: ProductCardCompactProps) {
  const [basePrice, setBasePrice] = useState(product.pricing.basePrice);
  const [maxPrice, setMaxPrice] = useState(product.pricing.maxPrice);
  const [cost, setCost] = useState(product.pricing.cost);
  const [editingField, setEditingField] = useState<'basePrice' | 'currentPrice' | null>(null);
  const [editValue, setEditValue] = useState('');

  const profitMargin = ((product.pricing.currentPrice - product.pricing.cost) / product.pricing.currentPrice) * 100;
  const totalInventory = product.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0);

  // Mock data
  const mockSalesData = {
    totalRevenue: 4250,
    unitsSold: 85,
    avgSalePrice: 50.0,
    conversionRate: 3.2,
  };

  const mockPriceHistory = [
    { date: 'Jan 15, 2025', oldPrice: 52.0, newPrice: 49.99, reason: 'Smart Pricing', revenue: 1250 },
    { date: 'Jan 10, 2025', oldPrice: 55.0, newPrice: 52.0, reason: 'Smart Pricing', revenue: 890 },
    { date: 'Jan 05, 2025', oldPrice: 50.0, newPrice: 55.0, reason: 'Smart Pricing', revenue: 1100 },
    { date: 'Dec 28, 2024', oldPrice: 48.0, newPrice: 50.0, reason: 'Manual Edit', revenue: 950 },
  ];

  const handleSaveSettings = () => {
    toast.success('Pricing settings updated', {
      description: `Base: $${basePrice.toFixed(2)}, Max: $${maxPrice.toFixed(2)}, Cost: $${cost.toFixed(2)}`,
    });
  };

  const handleStartEdit = (field: 'basePrice' | 'currentPrice', currentValue: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingField(field);
    setEditValue(currentValue.toFixed(2));
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = parseFloat(editValue);
    if (!isNaN(newValue) && newValue > 0) {
      if (editingField === 'basePrice') {
        setBasePrice(newValue);
      }
      toast.success('Price updated', {
        description: `${editingField === 'basePrice' ? 'Base' : 'Current'} price: $${newValue.toFixed(2)}`,
      });
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
      if (!isNaN(newValue) && newValue > 0) {
        if (editingField === 'basePrice') {
          setBasePrice(newValue);
        }
        toast.success('Price updated');
      }
      setEditingField(null);
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
  };

  return (
    <Card
      className={`
        overflow-hidden
        ${isExpanded ? 'w-full' : 'w-[280px]'}
        ${isExpanded ? 'shadow-xl' : 'shadow-md hover:shadow-lg'}
      `}
      style={{
        transition: 'width 1s ease-in-out, box-shadow 0.3s ease',
        height: '460px', // Fixed height matching collapsed card
      }}
    >
      <div className="flex h-full">
        {/* Left Side - Always Visible Square Section */}
        <div 
          className="relative flex-shrink-0 w-[280px] cursor-pointer group"
          onClick={onClick}
        >
          {/* Product Image - Slightly smaller */}
          <div className="relative w-full bg-muted overflow-hidden" style={{ height: '220px' }}>
            {product.images?.[0] ? (
              <Image
                src={product.images[0]}
                alt={product.title}
                fill
                sizes="280px"
                className="object-cover transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Package className="h-20 w-20 text-muted-foreground" />
              </div>
            )}

            {/* Smart Pricing Badge */}
            {smartPricingEnabled && (
              <div className="absolute top-3 right-3">
                <Badge variant="default" className="shadow-lg">
                  <Zap className="h-3 w-3 mr-1" />
                  ON
                </Badge>
              </div>
            )}

            {/* Expand Button */}
            <div className="absolute bottom-3 right-3">
              <Button
                size="icon"
                variant="secondary"
                className="rounded-full shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
              >
                <ChevronRight 
                  className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                />
              </Button>
            </div>
          </div>

          {/* Product Info Below Image */}
          <div className="p-3 bg-background flex flex-col h-[240px]">
            <h3 className="font-bold text-base line-clamp-1 mb-1">
              {product.title}
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              {product.vendor} • {totalInventory} in stock
            </p>
            
            {/* Editable Prices */}
            <div className="space-y-1.5 mb-2">
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
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleStartEdit('currentPrice', product.pricing.currentPrice, e)}
                    className="text-sm font-bold text-foreground hover:text-white hover:bg-primary transition-all duration-200 cursor-pointer px-2.5 py-1 rounded-md"
                  >
                    ${product.pricing.currentPrice.toFixed(2)}
                  </button>
                )}
              </div>
            </div>
            
            {/* Smart Pricing Toggle on Card */}
            <div 
              className="flex items-center justify-between p-2 rounded-lg border bg-card mt-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <Zap className={`h-4 w-4 ${smartPricingEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-xs font-medium">Smart Pricing</span>
              </div>
              <Switch
                checked={smartPricingEnabled}
                onCheckedChange={(checked) => onSmartPricingToggle(checked)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>

        {/* Right Side - Analytics (Only visible when expanded) */}
        {isExpanded && (
          <div 
            className="flex-1 border-l bg-accent/20 overflow-hidden"
            style={{
              animation: 'slideInRight 1s ease-in-out',
              height: '460px',
            }}
          >
            <div className="h-full overflow-y-auto">
            <div className="flex flex-col h-full">
              {/* Header with Tabs and Close Button */}
              <div className="flex items-center justify-between p-4 border-b bg-background">
                <Tabs defaultValue="analytics" className="flex-1">
                  <TabsList>
                    <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
                    <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
                    <TabsTrigger value="history">📜 History</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClick}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Tabs Content */}
              <Tabs defaultValue="analytics" className="flex-1 overflow-hidden">
                {/* Analytics Tab */}
                <TabsContent value="analytics" className="p-6 space-y-4">
                  {/* Simplified Revenue Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-semibold text-green-900 dark:text-green-100">With Smart Pricing</span>
                      </div>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                        ${mockSalesData.totalRevenue.toLocaleString()}
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Last 30 days
                      </p>
                    </Card>

                    <Card className="p-4 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-5 w-5 text-slate-600" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Without Smart Pricing</span>
                      </div>
                      <p className="text-3xl font-bold text-slate-600 dark:text-slate-400">
                        ${(mockSalesData.totalRevenue * 0.85).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                        Estimated
                      </p>
                    </Card>
                  </div>

                  {/* Additional Metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="p-3 bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Profit Margin</p>
                      <p className="text-xl font-bold text-green-600">
                        {profitMargin.toFixed(1)}%
                      </p>
                    </Card>
                    <Card className="p-3 bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Units Sold</p>
                      <p className="text-xl font-bold">
                        {mockSalesData.unitsSold}
                      </p>
                    </Card>
                    <Card className="p-3 bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Avg Price</p>
                      <p className="text-xl font-bold">
                        ${mockSalesData.avgSalePrice.toFixed(2)}
                      </p>
                    </Card>
                  </div>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="p-6 space-y-4">
                  <Card className="p-4 bg-background overflow-y-auto">
                    <h4 className="font-semibold mb-3 text-sm">Smart Pricing Configuration</h4>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor={`base-${product.id}`} className="text-xs">Base Price</Label>
                        <Input
                          id={`base-${product.id}`}
                          type="number"
                          step="0.01"
                          value={basePrice}
                          onChange={(e) => setBasePrice(parseFloat(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`max-${product.id}`} className="text-xs">Max Price</Label>
                        <Input
                          id={`max-${product.id}`}
                          type="number"
                          step="0.01"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(parseFloat(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cost-${product.id}`} className="text-xs">Cost</Label>
                        <Input
                          id={`cost-${product.id}`}
                          type="number"
                          step="0.01"
                          value={cost}
                          onChange={(e) => setCost(parseFloat(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>

                    <Button onClick={handleSaveSettings} className="w-full mt-4">
                      Save Settings
                    </Button>
                  </Card>
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="p-6 space-y-4">
                  <Card className="p-4 bg-background">
                    <h4 className="font-semibold mb-3 text-sm">Price Change History</h4>

                    <div className="space-y-2">
                      {mockPriceHistory.map((entry, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-4 gap-2 py-2 border-b last:border-0 text-xs hover:bg-accent/50 rounded transition-colors"
                        >
                          <div className="text-muted-foreground">{entry.date}</div>
                          <div className="font-mono">${entry.oldPrice.toFixed(2)} → ${entry.newPrice.toFixed(2)}</div>
                          <div>
                            <Badge variant={entry.reason === 'Smart Pricing' ? 'default' : 'secondary'} className="text-xs">
                              {entry.reason}
                            </Badge>
                          </div>
                          <div className="text-right font-semibold">
                            ${entry.revenue.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button variant="outline" className="w-full mt-3 text-xs" size="sm">
                      View Full History
                    </Button>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
