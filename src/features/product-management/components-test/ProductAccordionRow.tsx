// Experimental accordion-style product row with embedded analytics
'use client';

import { useState } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { ChevronDown, ChevronUp, Zap, TrendingUp, DollarSign, ShoppingCart, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductWithPricing } from '@/features/product-management/types';
import Image from 'next/image';

interface ProductAccordionRowProps {
  product: ProductWithPricing;
  isExpanded: boolean;
  onToggleExpand: () => void;
  smartPricingEnabled: boolean;
  onSmartPricingToggle: (enabled: boolean, newPrice?: number) => void;
}

export function ProductAccordionRow({
  product,
  isExpanded,
  onToggleExpand,
  smartPricingEnabled,
  onSmartPricingToggle,
}: ProductAccordionRowProps) {
  const [basePrice, setBasePrice] = useState(product.pricing.basePrice);
  const [maxPrice, setMaxPrice] = useState(product.pricing.maxPrice);
  const [cost, setCost] = useState(product.pricing.cost);

  const profitMargin = ((product.pricing.currentPrice - product.pricing.cost) / product.pricing.currentPrice) * 100;
  const totalInventory = product.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0);

  // Mock data for demonstration - would come from API in production
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
    // TODO: Call API to update pricing settings
    toast.success('Pricing settings updated', {
      description: `Base: $${basePrice.toFixed(2)}, Max: $${maxPrice.toFixed(2)}, Cost: $${cost.toFixed(2)}`,
    });
  };

  return (
    <Card className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'shadow-lg' : 'shadow-sm'}`}>
      {/* Collapsed Row - Always Visible */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={onToggleExpand}
      >
        {/* Product Image */}
        <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
          {product.images?.[0] ? (
            <Image
              src={product.images[0]}
              alt={product.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{product.title}</h3>
          <p className="text-sm text-muted-foreground">
            {product.vendor} • {totalInventory} in stock
          </p>
        </div>

        {/* Current Price */}
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">${product.pricing.currentPrice.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">
            Margin: {profitMargin.toFixed(1)}%
          </p>
        </div>

        {/* Smart Pricing Toggle */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card"
          onClick={(e) => e.stopPropagation()}
        >
          <Zap className={`h-4 w-4 ${smartPricingEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
          <Switch
            checked={smartPricingEnabled}
            onCheckedChange={(checked) => onSmartPricingToggle(checked)}
          />
        </div>

        {/* Expand/Collapse Button */}
        <Button variant="ghost" size="icon" className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Expanded Content - Accordion */}
      {isExpanded && (
        <div className="border-t bg-accent/20 p-6 space-y-6 animate-in slide-in-from-top duration-300">
          <Tabs defaultValue="analytics" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
              <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
              <TabsTrigger value="history">📜 History</TabsTrigger>
            </TabsList>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-4 mt-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-muted-foreground">Revenue (30d)</span>
                  </div>
                  <p className="text-2xl font-bold">${mockSalesData.totalRevenue.toLocaleString()}</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">Units Sold</span>
                  </div>
                  <p className="text-2xl font-bold">{mockSalesData.unitsSold}</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                    <span className="text-xs text-muted-foreground">Avg Price</span>
                  </div>
                  <p className="text-2xl font-bold">${mockSalesData.avgSalePrice.toFixed(2)}</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-orange-600" />
                    <span className="text-xs text-muted-foreground">Conversion</span>
                  </div>
                  <p className="text-2xl font-bold">{mockSalesData.conversionRate}%</p>
                </Card>
              </div>

              {/* Sales Chart Placeholder */}
              <Card className="p-6">
                <h4 className="font-semibold mb-4">Revenue Trend (Last 30 Days)</h4>
                <div className="h-[200px] flex items-center justify-center bg-muted rounded-lg">
                  <p className="text-muted-foreground">📈 Chart would go here (integrate with your analytics)</p>
                </div>
              </Card>

              {/* Quick Price Info */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Base Price</p>
                  <p className="text-lg font-semibold">${product.pricing.basePrice.toFixed(2)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Max Price</p>
                  <p className="text-lg font-semibold">${product.pricing.maxPrice.toFixed(2)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Cost</p>
                  <p className="text-lg font-semibold">${product.pricing.cost.toFixed(2)}</p>
                </Card>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-4">
              <Card className="p-6">
                <h4 className="font-semibold mb-4">Smart Pricing Configuration</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="space-y-2">
                    <Label htmlFor={`base-${product.id}`}>Base Price</Label>
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
                    <Label htmlFor={`max-${product.id}`}>Max Price</Label>
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
                    <Label htmlFor={`cost-${product.id}`}>Cost</Label>
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
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Profit Margin</p>
                    <p className="text-xl font-bold text-green-600">
                      {profitMargin.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Profit per Unit</p>
                    <p className="text-xl font-bold text-green-600">
                      ${(product.pricing.currentPrice - product.pricing.cost).toFixed(2)}
                    </p>
                  </div>
                </div>

                <Button onClick={handleSaveSettings} className="w-full">
                  Save Pricing Settings
                </Button>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4 mt-4">
              <Card className="p-6">
                <h4 className="font-semibold mb-4">Price Change History</h4>
                
                <div className="space-y-2">
                  {/* Table Header */}
                  <div className="grid grid-cols-5 gap-4 pb-2 border-b font-semibold text-sm text-muted-foreground">
                    <div>Date</div>
                    <div>Old Price</div>
                    <div>New Price</div>
                    <div>Reason</div>
                    <div className="text-right">Revenue</div>
                  </div>

                  {/* Table Rows */}
                  {mockPriceHistory.map((entry, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-5 gap-4 py-3 border-b last:border-0 text-sm hover:bg-accent/50 rounded-lg transition-colors"
                    >
                      <div className="text-muted-foreground">{entry.date}</div>
                      <div className="font-mono">${entry.oldPrice.toFixed(2)}</div>
                      <div className="font-mono font-semibold">${entry.newPrice.toFixed(2)}</div>
                      <div>
                        <Badge variant={entry.reason === 'Smart Pricing' ? 'default' : 'secondary'}>
                          {entry.reason}
                        </Badge>
                      </div>
                      <div className="text-right font-semibold">
                        ${entry.revenue.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="outline" className="w-full mt-4">
                  View Full History
                </Button>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Card>
  );
}

