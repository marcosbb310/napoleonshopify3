// Inline details panel that slides from card edge
'use client';

import { useState } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { X, Zap, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductWithPricing } from '@/features/product-management/types';

interface ProductDetailsPanelProps {
  product: ProductWithPricing;
  isOpen: boolean;
  onClose: () => void;
  smartPricingEnabled: boolean;
  onSmartPricingToggle: (enabled: boolean, newPrice?: number) => void;
}

export function ProductDetailsPanel({
  product,
  isOpen,
  onClose,
  smartPricingEnabled,
  onSmartPricingToggle,
}: ProductDetailsPanelProps) {
  const [basePrice, setBasePrice] = useState(product.pricing.basePrice);
  const [maxPrice, setMaxPrice] = useState(product.pricing.maxPrice);
  const [cost, setCost] = useState(product.pricing.cost);

  const profitMargin = ((product.pricing.currentPrice - product.pricing.cost) / product.pricing.currentPrice) * 100;
  const totalInventory = product.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0);

  // Mock data for demonstration
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

  if (!isOpen) return null;

  return (
    <Card className="h-full overflow-hidden">
      <div className="p-6 space-y-6 h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Product Details</h3>
            <p className="text-sm text-muted-foreground">
              Configure settings and view analytics
            </p>
          </div>
          
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Smart Pricing Toggle */}
        <Card className="p-4 bg-accent/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className={`h-5 w-5 ${smartPricingEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-semibold">Smart Pricing</p>
                <p className="text-xs text-muted-foreground">
                  {smartPricingEnabled ? 'Algorithm is optimizing this product' : 'Price optimization is disabled'}
                </p>
              </div>
            </div>
            <Switch
              checked={smartPricingEnabled}
              onCheckedChange={(checked) => onSmartPricingToggle(checked)}
            />
          </div>
        </Card>

        {/* Tabbed Content */}
        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
            <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
            <TabsTrigger value="history">📜 History</TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4 mt-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Revenue (30d)</span>
                </div>
                <p className="text-xl font-bold">${mockSalesData.totalRevenue.toLocaleString()}</p>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">Units Sold</span>
                </div>
                <p className="text-xl font-bold">{mockSalesData.unitsSold}</p>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-muted-foreground">Avg Price</span>
                </div>
                <p className="text-xl font-bold">${mockSalesData.avgSalePrice.toFixed(2)}</p>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-muted-foreground">Conversion</span>
                </div>
                <p className="text-xl font-bold">{mockSalesData.conversionRate}%</p>
              </Card>
            </div>

            {/* Sales Chart Placeholder */}
            <Card className="p-4">
              <h4 className="font-semibold mb-3 text-sm">Revenue Trend (Last 30 Days)</h4>
              <div className="h-[180px] flex items-center justify-center bg-muted rounded-lg">
                <p className="text-muted-foreground text-sm">📈 Chart would go here</p>
              </div>
            </Card>

            {/* Quick Price Info */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Base Price</p>
                <p className="text-base font-semibold">${product.pricing.basePrice.toFixed(2)}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Max Price</p>
                <p className="text-base font-semibold">${product.pricing.maxPrice.toFixed(2)}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Cost</p>
                <p className="text-base font-semibold">${product.pricing.cost.toFixed(2)}</p>
              </Card>
            </div>

            {/* Profit Info */}
            <Card className="p-3 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Profit Margin</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {profitMargin.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profit per Unit</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    ${(product.pricing.currentPrice - product.pricing.cost).toFixed(2)}
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card className="p-4">
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
                  />
                  <p className="text-xs text-muted-foreground">Starting price for algorithm</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`max-${product.id}`} className="text-xs">Max Price</Label>
                  <Input
                    id={`max-${product.id}`}
                    type="number"
                    step="0.01"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Maximum allowed price</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`cost-${product.id}`} className="text-xs">Cost</Label>
                  <Input
                    id={`cost-${product.id}`}
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Your cost per unit</p>
                </div>
              </div>

              {/* Calculated Metrics */}
              <div className="grid grid-cols-2 gap-3 mt-4 p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Current Profit Margin</p>
                  <p className="text-lg font-bold text-green-600">
                    {profitMargin.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profit per Unit</p>
                  <p className="text-lg font-bold text-green-600">
                    ${(product.pricing.currentPrice - product.pricing.cost).toFixed(2)}
                  </p>
                </div>
              </div>

              <Button onClick={handleSaveSettings} className="w-full mt-4">
                Save Pricing Settings
              </Button>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 mt-4">
            <Card className="p-4">
              <h4 className="font-semibold mb-3 text-sm">Price Change History</h4>

              <div className="space-y-2">
                {/* Table Rows */}
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
    </Card>
  );
}

