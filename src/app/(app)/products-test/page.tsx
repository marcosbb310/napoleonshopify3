// EXPERIMENTAL PAGE - Testing grid layout with right-side analytics panel
// Grid format with sidebar modal that slides in from the right
// Can be safely deleted if not preferred
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  useProducts, 
  type ProductFilter, 
  type ProductWithPricing,
  ProductCard,
  ProductCardSkeleton,
} from '@/features/product-management';
import { 
  useSmartPricing, 
  useUndoState, 
  SmartPricingResumeModal, 
  SmartPricingConfirmDialog,
  UndoButton 
} from '@/features/pricing-engine';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/shared/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Label } from '@/shared/components/ui/label';
import { Zap, Search, ArrowLeft, AlertCircle, DollarSign, TrendingUp, ShoppingCart, Package, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

export default function ProductsTestPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ProductFilter>({
    sortBy: 'title',
    sortDirection: 'asc',
  });
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());


  // Get all products
  const { products: allProducts, loading, error, refetch } = useProducts();

  // Smart pricing hook
  const { 
    globalEnabled, 
    handleGlobalToggle,
    confirmGlobalDisable,
    confirmGlobalEnable,
    confirmGlobalResume,
    isLoadingGlobal,
    showGlobalConfirm,
    setShowGlobalConfirm,
    showGlobalResumeModal,
    setShowGlobalResumeModal,
    pendingGlobalAction,
    globalPriceOptions,
    globalSnapshots,
    setGlobalSnapshots,
    isProductEnabled, 
    setProductState, 
  } = useSmartPricing();

  // Undo state management
  const { canUndo, formatTimeRemaining, setUndo, executeUndo, undoState } = useUndoState();

  const [productUpdates, setProductUpdates] = useState<Map<string, Partial<ProductWithPricing['pricing']>>>(new Map());

  // Pricing settings for selected product (for analytics panel)
  const [basePrice, setBasePrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [cost, setCost] = useState(0);
  
  // Inline editing state for Quick Price Info cards
  const [editingQuickField, setEditingQuickField] = useState<'basePrice' | 'currentPrice' | 'maxPrice' | null>(null);
  const [quickEditValue, setQuickEditValue] = useState('');

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

  // Set undo state when global snapshots change
  useEffect(() => {
    if (globalSnapshots && globalSnapshots.length > 0) {
      const action = globalEnabled ? 'global-on' : 'global-off';
      const description = globalEnabled 
        ? `enabled for ${globalSnapshots.length} products`
        : `disabled for ${globalSnapshots.length} products`;
      
      setUndo(action, globalSnapshots, description);
      
      // Update product prices
      setProductUpdates(prev => {
        const newMap = new Map(prev);
        globalSnapshots.forEach(snapshot => {
          if (snapshot.newPrice !== undefined) {
            const existingUpdates = newMap.get(snapshot.shopifyId) || {};
            newMap.set(snapshot.shopifyId, { 
              ...existingUpdates, 
              currentPrice: snapshot.newPrice 
            });
          }
        });
        return newMap;
      });
      
      setGlobalSnapshots(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSnapshots, globalEnabled]);

  // Filter and search products - compute on every render to avoid useEffect + setState loops
  const products = useMemo(() => {
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
  }, [allProducts, searchQuery, filter, productUpdates]);

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

  const handleTagClick = (tag: string) => {
    setSelectedTags(prevTags => {
      const newTags = new Set(prevTags);
      if (newTags.has(tag)) {
        newTags.delete(tag);
      } else {
        newTags.add(tag);
      }
      return newTags;
    });
  };

  // Open analytics panel for a product
  const handleViewAnalytics = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProductId(productId);
      setBasePrice(product.pricing.basePrice);
      setMaxPrice(product.pricing.maxPrice);
      setCost(product.pricing.cost);
      // Reset editing state when opening modal
      setEditingQuickField(null);
    }
  };

  // Save pricing settings from analytics panel
  const handleSaveSettings = () => {
    if (!selectedProductId) return;
    
    setProductUpdates(prev => {
      const newMap = new Map(prev);
      const existingUpdates = newMap.get(selectedProductId) || {};
      newMap.set(selectedProductId, { 
        ...existingUpdates, 
        basePrice,
        maxPrice,
        cost,
      });
      return newMap;
    });

    toast.success('Pricing settings updated', {
      description: `Base: $${basePrice.toFixed(2)}, Max: $${maxPrice.toFixed(2)}, Cost: $${cost.toFixed(2)}`,
    });
  };

  // Quick edit handlers for inline price editing
  const handleStartQuickEdit = (field: 'basePrice' | 'currentPrice' | 'maxPrice', currentValue: number) => {
    setEditingQuickField(field);
    setQuickEditValue(currentValue.toFixed(2));
  };

  const handleSaveQuickEdit = () => {
    if (!editingQuickField || !selectedProductId) return;
    
    const newValue = parseFloat(quickEditValue);
    if (isNaN(newValue) || newValue <= 0) {
      toast.error('Invalid price', { description: 'Please enter a valid positive number' });
      return;
    }

    // Update the state based on which field is being edited
    if (editingQuickField === 'basePrice') {
      setBasePrice(newValue);
    } else if (editingQuickField === 'currentPrice') {
      // Current price is handled differently - update product directly
    } else if (editingQuickField === 'maxPrice') {
      setMaxPrice(newValue);
    }

    // Update product in the main updates map
    setProductUpdates(prev => {
      const newMap = new Map(prev);
      const existingUpdates = newMap.get(selectedProductId) || {};
      newMap.set(selectedProductId, { 
        ...existingUpdates, 
        [editingQuickField]: newValue 
      });
      return newMap;
    });

    toast.success('Price updated', {
      description: `${editingQuickField === 'basePrice' ? 'Base Price' : editingQuickField === 'currentPrice' ? 'Current Price' : 'Max Price'}: $${newValue.toFixed(2)}`,
    });

    setEditingQuickField(null);
  };

  const handleCancelQuickEdit = () => {
    setEditingQuickField(null);
  };

  const handleQuickEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveQuickEdit();
    } else if (e.key === 'Escape') {
      handleCancelQuickEdit();
    }
  };

  // Get selected product for analytics panel
  const selectedProduct = selectedProductId ? products.find(p => p.id === selectedProductId) : null;

  // Mock analytics data (would come from API in production)
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
            <h1 className="text-3xl font-bold tracking-tight">Products (Grid + Sidebar)</h1>
            <Badge variant="secondary" className="text-xs">
              🧪 TEST VERSION
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Grid layout with right-side analytics panel - clean and comfortable
          </p>
        </div>
      </div>


      {/* Alert Banner */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-100">
              This is a test page - Grid + Right Sidebar Layout
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Click on any product card's expand button to slide out a right-side analytics panel. 
              The grid stays visible (dimmed) and you can easily navigate between products.
            </p>
          </div>
        </div>
      </Card>

      {/* Global Controls */}
      <div className="flex items-center justify-between gap-4">
        {/* Global Smart Pricing Toggle */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card shadow-sm">
          <div className="flex items-center gap-2">
            <Zap className={`h-5 w-5 ${globalEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-sm font-medium">Global Smart Pricing</span>
            <Badge variant={globalEnabled ? 'default' : 'secondary'} className="text-xs">
              {globalEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
          <Switch 
            checked={globalEnabled}
            onCheckedChange={(checked) => handleGlobalToggle(!checked)}
            disabled={isLoadingGlobal}
            aria-label="Toggle smart pricing globally"
          />
        </div>

        {/* Undo Button */}
        {canUndo && (
          <UndoButton
            onClick={async () => {
              const result = await executeUndo();
              if (result.success) {
                toast.success(`Undone: ${undoState?.description}`);
                if (result.snapshots) {
                  setProductUpdates(prev => {
                    const newMap = new Map(prev);
                    result.snapshots.forEach((snapshot: any) => {
                      if (snapshot.price !== undefined) {
                        const existingUpdates = newMap.get(snapshot.shopifyId) || {};
                        newMap.set(snapshot.shopifyId, { 
                          ...existingUpdates, 
                          currentPrice: snapshot.price 
                        });
                      }
                    });
                    return newMap;
                  });
                }
              } else {
                toast.error('Failed to undo');
              }
            }}
            description={undoState?.description || ''}
            timeRemaining={formatTimeRemaining()}
          />
        )}

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

      {/* Product Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isSelected={false}
              onSelect={() => {}}
              onEdit={() => console.log('Edit product:', product)}
              selectedTags={selectedTags}
              onTagClick={handleTagClick}
              onShowVariants={() => {}}
              isShowingVariants={false}
              smartPricingEnabled={isProductEnabled(product.id)}
              onSmartPricingToggle={(enabled, newPrice) => handleProductSmartPricingToggle(product.id, enabled, newPrice)}
              onViewAnalytics={handleViewAnalytics}
            />
          ))}
        </div>
      )}

      {/* Right-Side Analytics Panel (Sheet) */}
      <Sheet open={!!selectedProductId} onOpenChange={(open) => !open && setSelectedProductId(null)}>
        <SheetContent side="right" className="w-full sm:!max-w-[458px] lg:!max-w-[574px] xl:!max-w-[694px] overflow-y-auto p-6 sm:p-8">
          {selectedProduct && (
            <>
              <SheetHeader className="pb-6 border-b">
                <div className="flex items-start gap-4">
                  {selectedProduct.images[0] && (
                    <div className="relative h-24 w-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted border-2">
                      <Image
                        src={selectedProduct.images[0].src}
                        alt={selectedProduct.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-2xl mb-2">{selectedProduct.title}</SheetTitle>
                    <SheetDescription className="text-base">
                      {selectedProduct.vendor} • {selectedProduct.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0)} in stock
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 px-1">
                <Tabs defaultValue="analytics" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
                    <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
                    <TabsTrigger value="history">📜 History</TabsTrigger>
                  </TabsList>

                  {/* Analytics Tab */}
                  <TabsContent value="analytics" className="space-y-6 mt-6">
                    {/* Revenue Comparison - With vs Without Smart Pricing */}
                    <div className="grid grid-cols-2 gap-6">
                      <Card className="p-6 border-2 border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground">Revenue (30d)</p>
                            <p className="text-xs text-green-600 font-medium">With Smart Pricing</p>
                          </div>
                        </div>
                        <p className="text-4xl font-bold text-green-600 mb-2">
                          ${mockSalesData.totalRevenue.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1 text-sm text-green-600">
                          <TrendingUp className="h-4 w-4" />
                          <span className="font-semibold">+15.3%</span>
                          <span className="text-muted-foreground">vs. base</span>
                        </div>
                      </Card>

                      <Card className="p-6 border-2 border-muted">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground">Revenue (30d)</p>
                            <p className="text-xs text-muted-foreground font-medium">Without Smart Pricing</p>
                          </div>
                        </div>
                        <p className="text-4xl font-bold text-muted-foreground mb-2">
                          ${(mockSalesData.totalRevenue / 1.153).toFixed(0).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <span className="font-semibold">Base price revenue</span>
                        </div>
                      </Card>
                    </div>

                    {/* Key Insight Card */}
                    <Card className="p-6 bg-primary/5 border-2 border-primary/20">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg mb-2">Smart Pricing Impact</h4>
                          <p className="text-muted-foreground mb-3">
                            Smart pricing has generated an additional <span className="font-bold text-primary">${(mockSalesData.totalRevenue - mockSalesData.totalRevenue / 1.153).toFixed(0)}</span> in revenue over the last 30 days by dynamically optimizing prices based on market conditions and demand.
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Avg Price Increase</p>
                              <p className="font-bold text-primary">+12.5%</p>
                            </div>
                            <div className="h-8 w-px bg-border"></div>
                            <div>
                              <p className="text-muted-foreground">Units Sold</p>
                              <p className="font-bold">{mockSalesData.unitsSold}</p>
                            </div>
                            <div className="h-8 w-px bg-border"></div>
                            <div>
                              <p className="text-muted-foreground">Conversion Rate</p>
                              <p className="font-bold">{mockSalesData.conversionRate}%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {/* Quick Price Info - Editable */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* Base Price */}
                      <Card className="p-5 hover:border-primary/40 transition-colors">
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Base Price</p>
                        {editingQuickField === 'basePrice' ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={quickEditValue}
                              onChange={(e) => setQuickEditValue(e.target.value)}
                              onKeyDown={handleQuickEditKeyDown}
                              className="h-9 text-base font-semibold"
                              autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleSaveQuickEdit}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleCancelQuickEdit}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartQuickEdit('basePrice', basePrice)}
                            className="text-2xl font-bold text-foreground hover:text-white hover:bg-primary transition-all duration-200 cursor-pointer px-3 py-1.5 rounded-md w-full text-left"
                          >
                            ${basePrice.toFixed(2)}
                          </button>
                        )}
                      </Card>

                      {/* Current Price */}
                      <Card className="p-5 hover:border-primary/40 transition-colors">
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Current Price</p>
                        {editingQuickField === 'currentPrice' ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={quickEditValue}
                              onChange={(e) => setQuickEditValue(e.target.value)}
                              onKeyDown={handleQuickEditKeyDown}
                              className="h-9 text-base font-semibold"
                              autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleSaveQuickEdit}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleCancelQuickEdit}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartQuickEdit('currentPrice', selectedProduct.pricing.currentPrice)}
                            className="text-2xl font-bold text-foreground hover:text-white hover:bg-primary transition-all duration-200 cursor-pointer px-3 py-1.5 rounded-md w-full text-left"
                          >
                            ${selectedProduct.pricing.currentPrice.toFixed(2)}
                          </button>
                        )}
                      </Card>

                      {/* Max Price */}
                      <Card className="p-5 hover:border-primary/40 transition-colors">
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Max Price</p>
                        {editingQuickField === 'maxPrice' ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={quickEditValue}
                              onChange={(e) => setQuickEditValue(e.target.value)}
                              onKeyDown={handleQuickEditKeyDown}
                              className="h-9 text-base font-semibold"
                              autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleSaveQuickEdit}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleCancelQuickEdit}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartQuickEdit('maxPrice', maxPrice)}
                            className="text-2xl font-bold text-foreground hover:text-white hover:bg-primary transition-all duration-200 cursor-pointer px-3 py-1.5 rounded-md w-full text-left"
                          >
                            ${maxPrice.toFixed(2)}
                          </button>
                        )}
                      </Card>
                    </div>
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="space-y-6 mt-6">
                    <Card className="p-8 border-2">
                      <h4 className="font-semibold mb-4">Smart Pricing Configuration</h4>
                      
                      <div className="grid grid-cols-1 gap-4 mb-6">
                        <div className="space-y-2">
                          <Label htmlFor={`base-${selectedProduct.id}`}>Base Price</Label>
                          <Input
                            id={`base-${selectedProduct.id}`}
                            type="number"
                            step="0.01"
                            value={basePrice}
                            onChange={(e) => setBasePrice(parseFloat(e.target.value))}
                          />
                          <p className="text-xs text-muted-foreground">Starting price for algorithm</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`max-${selectedProduct.id}`}>Max Price</Label>
                          <Input
                            id={`max-${selectedProduct.id}`}
                            type="number"
                            step="0.01"
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(parseFloat(e.target.value))}
                          />
                          <p className="text-xs text-muted-foreground">Maximum allowed price</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`cost-${selectedProduct.id}`}>Cost</Label>
                          <Input
                            id={`cost-${selectedProduct.id}`}
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
                            {(((selectedProduct.pricing.currentPrice - selectedProduct.pricing.cost) / selectedProduct.pricing.currentPrice) * 100).toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Profit per Unit</p>
                          <p className="text-xl font-bold text-green-600">
                            ${(selectedProduct.pricing.currentPrice - selectedProduct.pricing.cost).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <Button onClick={handleSaveSettings} className="w-full">
                        Save Pricing Settings
                      </Button>
                    </Card>
                  </TabsContent>

                  {/* History Tab */}
                  <TabsContent value="history" className="space-y-6 mt-6">
                    <Card className="p-8 border-2">
                      <h4 className="font-semibold mb-4">Price Change History</h4>
                      
                      <div className="space-y-3">
                        {/* Table Header */}
                        <div className="grid grid-cols-4 gap-4 pb-3 border-b font-semibold text-sm text-muted-foreground">
                          <div>Date</div>
                          <div>Old → New</div>
                          <div>Reason</div>
                          <div className="text-right">Revenue</div>
                        </div>

                        {/* Table Rows */}
                        {mockPriceHistory.map((entry, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-4 gap-4 py-4 border-b last:border-0 text-sm hover:bg-accent/50 rounded-lg transition-colors px-2"
                          >
                            <div className="text-sm text-muted-foreground">{entry.date}</div>
                            <div className="text-sm">
                              <span className="font-mono">${entry.oldPrice.toFixed(2)}</span>
                              {' → '}
                              <span className="font-mono font-semibold">${entry.newPrice.toFixed(2)}</span>
                            </div>
                            <div>
                              <Badge variant={entry.reason === 'Smart Pricing' ? 'default' : 'secondary'} className="text-xs">
                                {entry.reason}
                              </Badge>
                            </div>
                            <div className="text-right font-semibold text-sm">
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
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Global Smart Pricing Confirmation Dialog */}
      <SmartPricingConfirmDialog
        open={showGlobalConfirm}
        onOpenChange={setShowGlobalConfirm}
        onConfirm={pendingGlobalAction === 'disable' ? confirmGlobalDisable : confirmGlobalEnable}
        type={pendingGlobalAction === 'disable' ? 'global-disable' : 'global-enable'}
        productCount={allProducts.length}
      />

      {/* Global Smart Pricing Resume Modal */}
      <SmartPricingResumeModal
        open={showGlobalResumeModal}
        onOpenChange={setShowGlobalResumeModal}
        onConfirm={confirmGlobalResume}
        productCount={allProducts.length}
        basePrice={globalPriceOptions?.base || 0}
        lastSmartPrice={globalPriceOptions?.last || 0}
      />
    </div>
  );
}

