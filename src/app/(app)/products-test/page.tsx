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
  UndoButton,
  PowerButton 
} from '@/features/pricing-engine';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/shared/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Label } from '@/shared/components/ui/label';
import { Zap, Search, ArrowLeft, AlertCircle, DollarSign, TrendingUp, ShoppingCart, Package, X, Check, Loader2, BarChart3 } from 'lucide-react';
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
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());


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

  // Performance data state
  const [performanceData, setPerformanceData] = useState<Record<string, unknown> | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);

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

  const handleSelectProduct = (productId: string) => {
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
      // Fetch performance data
      fetchPerformanceData(productId);
    }
  };

  // Fetch performance data for selected product
  const fetchPerformanceData = async (productId: string) => {
    console.log('Fetching performance for product:', productId);
    setLoadingPerformance(true);
    try {
      const response = await fetch(`/api/products/${productId}/performance`);
      console.log('Performance API response status:', response.status);
      
      const result = await response.json();
      console.log('Performance API result:', result);
      
      if (result.success) {
        setPerformanceData(result.data);
      } else {
        console.error('Failed to fetch performance data:', result.error);
        toast.error('Failed to load performance data', { 
          description: result.error || 'Unknown error' 
        });
        setPerformanceData(null);
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
      toast.error('Error loading performance data', { 
        description: error instanceof Error ? error.message : 'Unknown error' 
      });
      setPerformanceData(null);
    } finally {
      setLoadingPerformance(false);
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

  const handleSaveQuickEdit = async () => {
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

    // Save to database via API
    try {
      const updatePayload: Record<string, unknown> = { productId: selectedProductId };
      
      if (editingQuickField === 'basePrice') {
        updatePayload.startingPrice = newValue;
      } else if (editingQuickField === 'currentPrice') {
        updatePayload.currentPrice = newValue;
      } else if (editingQuickField === 'maxPrice') {
        updatePayload.maxPrice = newValue;
      }

      const response = await fetch('/api/analytics/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Price updated', {
          description: `${editingQuickField === 'basePrice' ? 'Base Price' : editingQuickField === 'currentPrice' ? 'Current Price' : 'Max Price'}: $${newValue.toFixed(2)}`,
        });
        
        // Refresh products to get latest data
        refetch();
      } else {
        toast.error('Failed to save price', {
          description: result.error || 'Unknown error occurred',
        });
      }
    } catch (error) {
      console.error('Error saving price:', error);
      toast.error('Failed to save price', {
        description: 'Network error occurred',
      });
    }

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
      {/* Header with Controls */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog and pricing
          </p>
        </div>

        {/* Right: Search and Global Toggle */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Global Smart Pricing Toggle */}
          <PowerButton 
            enabled={globalEnabled}
            onToggle={handleGlobalToggle}
            disabled={isLoadingGlobal}
            label="Global Smart Pricing"
          />
        </div>
      </div>

      {/* Undo Button - Now on its own row if visible */}
      {canUndo && (
        <div className="flex justify-end">
          <UndoButton
            onClick={async () => {
              const result = await executeUndo();
              if (result.success) {
                toast.success(`Undone: ${undoState?.description}`);
                if ('snapshots' in result && result.snapshots) {
                  setProductUpdates(prev => {
                    const newMap = new Map(prev);
                    (result.snapshots as Record<string, unknown>[]).forEach((snapshot: Record<string, unknown>) => {
                      if (snapshot.price !== undefined) {
                        const existingUpdates = newMap.get(snapshot.shopifyId as string) || {};
                        newMap.set(snapshot.shopifyId as string, { 
                          ...existingUpdates, 
                          currentPrice: snapshot.price as number 
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
        </div>
      )}

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
              isSelected={selectedProductIds.has(product.id)}
              onSelect={handleSelectProduct}
              onEdit={() => console.log('Edit product:', product)}
              selectedTags={selectedTags}
              onTagClick={handleTagClick}
              onShowVariants={() => {}}
              isShowingVariants={false}
              smartPricingEnabled={isProductEnabled(product.id)}
              onSmartPricingToggle={(enabled, newPrice) => handleProductSmartPricingToggle(product.id, enabled, newPrice)}
              onViewAnalytics={handleViewAnalytics}
              hasAnySelection={selectedProductIds.size > 0}
              globalSmartPricingEnabled={globalEnabled}
            />
          ))}
        </div>
      )}

      {/* Right-Side Analytics Panel (Sheet) */}
      <Sheet open={!!selectedProductId} onOpenChange={(open) => !open && setSelectedProductId(null)}>
        <SheetContent 
          side="right" 
          className="w-full sm:!max-w-[500px] overflow-y-auto p-0 transition-all duration-700 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-1/2 data-[state=open]:slide-in-from-right-1/2 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          {selectedProduct && (
            <>
              {/* Header with Product Image */}
              <div className="relative h-48 bg-gradient-to-br from-muted to-muted/50">
                {selectedProduct.images[0] && (
                  <>
                    <Image
                      src={selectedProduct.images[0].src}
                      alt={selectedProduct.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/75" />
                  </>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <SheetTitle className="text-2xl mb-1 text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                    {selectedProduct.title}
                  </SheetTitle>
                  <SheetDescription className="text-white/90" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                    {selectedProduct.vendor} • {selectedProduct.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0)} in stock
                  </SheetDescription>
                </div>
              </div>

              <div className="p-6">
                {/* Smart Pricing Toggle - Prominent at top */}
                <div className="mb-6 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className={`h-5 w-5 ${isProductEnabled(selectedProduct.id) ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <p className="font-semibold">Smart Pricing</p>
                        <p className="text-xs text-muted-foreground">
                          {isProductEnabled(selectedProduct.id) ? 'Active - Auto-adjusting price' : 'Disabled - Using base price'}
                        </p>
                      </div>
                    </div>
                    <Switch 
                      checked={isProductEnabled(selectedProduct.id)}
                      onCheckedChange={(checked) => handleProductSmartPricingToggle(selectedProduct.id, checked)}
                    />
                  </div>
                </div>

                <Tabs defaultValue="analytics" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                  </TabsList>

                  {/* Analytics Tab */}
                  <TabsContent value="analytics" className="space-y-5">
                    {/* Product Title */}
                    <div className="text-center pb-2">
                      <h3 className="text-2xl font-bold">{selectedProduct.title}</h3>
                    </div>

                    {/* Editable Pricing Fields */}
                    <div className="space-y-3">
                      {/* Base Price - Editable */}
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">Base Price</span>
                          {editingQuickField === 'basePrice' ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={quickEditValue}
                                onChange={(e) => setQuickEditValue(e.target.value)}
                                onKeyDown={handleQuickEditKeyDown}
                                className="w-28 text-right h-9"
                                autoFocus
                              />
                              <Button size="sm" variant="ghost" onClick={handleSaveQuickEdit}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelQuickEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold">${selectedProduct.pricing.basePrice.toFixed(2)}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartQuickEdit('basePrice', selectedProduct.pricing.basePrice)}
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Starting price for smart pricing algorithm</p>
                      </div>

                      {/* Current Price - Editable */}
                      <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/30">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">Current Price</span>
                          {editingQuickField === 'currentPrice' ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={quickEditValue}
                                onChange={(e) => setQuickEditValue(e.target.value)}
                                onKeyDown={handleQuickEditKeyDown}
                                className="w-28 text-right h-9"
                                autoFocus
                              />
                              <Button size="sm" variant="ghost" onClick={handleSaveQuickEdit}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelQuickEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-3xl font-bold text-primary">${selectedProduct.pricing.currentPrice.toFixed(2)}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartQuickEdit('currentPrice', selectedProduct.pricing.currentPrice)}
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Active price on Shopify store</p>
                      </div>

                      {/* Maximum Price - Editable */}
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">Maximum Price</span>
                          {editingQuickField === 'maxPrice' ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={quickEditValue}
                                onChange={(e) => setQuickEditValue(e.target.value)}
                                onKeyDown={handleQuickEditKeyDown}
                                className="w-28 text-right h-9"
                                autoFocus
                              />
                              <Button size="sm" variant="ghost" onClick={handleSaveQuickEdit}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelQuickEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold">${selectedProduct.pricing.maxPrice.toFixed(2)}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartQuickEdit('maxPrice', selectedProduct.pricing.maxPrice)}
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Maximum price ceiling for algorithm</p>
                      </div>

                      {/* Last Price Change - Read Only */}
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">Last Price Change</span>
                          <span className="text-lg font-semibold">
                            {selectedProduct.pricing.lastUpdated 
                              ? new Date(selectedProduct.pricing.lastUpdated).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Never'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Last time pricing was updated</p>
                      </div>
                    </div>

                    {/* Profit Margin - Calculated */}
                    <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-muted-foreground">Profit Margin</span>
                        <span className="text-2xl font-bold text-green-600">
                          {(((selectedProduct.pricing.currentPrice - selectedProduct.pricing.cost) / selectedProduct.pricing.currentPrice) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Profit: ${(selectedProduct.pricing.currentPrice - selectedProduct.pricing.cost).toFixed(2)} per unit
                      </p>
                    </div>

                    {/* Variants List */}
                    {selectedProduct.variants.length > 1 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Variants ({selectedProduct.variants.length})</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedProduct.variants.map((variant) => (
                            <div key={variant.id} className="flex justify-between items-center py-2 px-3 bg-muted/20 rounded text-sm">
                              <div>
                                <p className="font-medium">{variant.title}</p>
                                <p className="text-xs text-muted-foreground">{variant.inventoryQuantity || 0} in stock</p>
                              </div>
                              <p className="font-semibold">${parseFloat(variant.price).toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Performance Tab */}
                  <TabsContent value="performance" className="space-y-5">
                    {/* Product Title */}
                    <div className="text-center pb-2">
                      <h3 className="text-2xl font-bold">{selectedProduct.title}</h3>
                    </div>

                    {loadingPerformance ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-3 text-muted-foreground">Loading performance data...</span>
                      </div>
                    ) : performanceData ? (
                      <>
                        {/* Smart Pricing Impact - Hero Section */}
                        <div className="p-5 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-950/10 rounded-lg border-2 border-green-200 dark:border-green-900">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                            <h4 className="font-semibold text-lg">Smart Pricing Impact</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Revenue Increase</p>
                              <p className="text-3xl font-bold text-green-600">
                                {((performanceData.summary as Record<string, unknown>).revenueIncreasePercent as number) >= 0 ? '+' : ''}
                                {((performanceData.summary as Record<string, unknown>).revenueIncreasePercent as number).toFixed(1)}%
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {((performanceData.summary as Record<string, unknown>).revenueIncrease as number) >= 0 ? '+' : ''}
                                ${((performanceData.summary as Record<string, unknown>).revenueIncrease as number).toFixed(2)} vs baseline
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                              <p className="text-3xl font-bold">${((performanceData.summary as Record<string, unknown>).totalRevenue as number).toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {(performanceData.summary as Record<string, unknown>).totalUnits as number} units sold
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-4 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Avg Sale Price</p>
                              <p className="text-xl font-bold">${((performanceData.summary as Record<string, unknown>).avgPrice as number).toFixed(2)}</p>
                          </div>
                          <div className="p-4 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Price Changes</p>
                            <p className="text-xl font-bold">{(performanceData.summary as Record<string, unknown>).priceChanges as number}</p>
                          </div>
                          <div className="p-4 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Base Price</p>
                              <p className="text-xl font-bold">${((performanceData.product as Record<string, unknown>).startingPrice as number).toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Price History Performance */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Performance by Price Point
                          </h4>
                          
                          {(performanceData.priceHistory as Record<string, unknown>[]).length > 0 ? (
                            <div className="space-y-2">
                              {(performanceData.priceHistory as Record<string, unknown>[]).map((entry: Record<string, unknown>, index: number) => {
                                const priceChange = (entry.newPrice as number) - (entry.oldPrice as number);
                                const priceChangePercent = ((priceChange / (entry.oldPrice as number)) * 100);
                                
                                return (
                                  <div key={index} className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors border border-muted">
                                    {/* Header: Price Change */}
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-lg font-bold">
                                            ${entry.oldPrice.toFixed(2)} → ${entry.newPrice.toFixed(2)}
                                          </span>
                                          <Badge 
                                            variant={priceChange > 0 ? 'default' : 'secondary'}
                                            className={priceChange > 0 ? 'bg-blue-600' : ''}
                                          >
                                            {priceChange > 0 ? '↑' : '↓'} 
                                            {Math.abs(priceChangePercent).toFixed(1)}%
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          {new Date(entry.date).toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric', 
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </p>
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {entry.action}
                                      </Badge>
                                    </div>

                                    {/* Performance Metrics */}
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="p-3 bg-background/50 rounded">
                                        <p className="text-xs text-muted-foreground mb-1">Revenue After Change</p>
                                        <p className="text-lg font-bold">${entry.revenue.toFixed(2)}</p>
                                        {entry.revenueChangePercent !== null && (
                                          <p className={`text-xs font-medium ${entry.revenueChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {entry.revenueChangePercent >= 0 ? '↑' : '↓'} 
                                            {Math.abs(entry.revenueChangePercent).toFixed(1)}% from previous
                                          </p>
                                        )}
                                      </div>
                                      <div className="p-3 bg-background/50 rounded">
                                        <p className="text-xs text-muted-foreground mb-1">Units Sold</p>
                                        <p className="text-lg font-bold">{entry.units}</p>
                                        <p className="text-xs text-muted-foreground">
                                          ${entry.units > 0 ? (entry.revenue / entry.units).toFixed(2) : '0.00'}/unit
                                        </p>
                                      </div>
                                    </div>

                                    {/* Reason */}
                                    {entry.reason && (
                                      <div className="mt-3 pt-3 border-t border-muted">
                                        <p className="text-xs text-muted-foreground">
                                          <span className="font-medium">Reason:</span> {entry.reason}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-8 text-center bg-muted/30 rounded-lg">
                              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                              <p className="text-sm text-muted-foreground">No price changes yet</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Enable smart pricing to see performance data
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Baseline Comparison */}
                        <div className="p-4 bg-muted/30 rounded-lg">
                          <h4 className="font-semibold text-sm mb-3">What if Smart Pricing was Disabled?</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">With Smart Pricing</p>
                              <p className="text-2xl font-bold text-green-600">
                                ${performanceData.summary.totalRevenue.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">At Base Price Only</p>
                              <p className="text-2xl font-bold text-muted-foreground">
                                ${performanceData.summary.baselineRevenue.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center bg-muted/30 rounded-lg">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No performance data available</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Data will appear once smart pricing makes changes
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="space-y-5">
                    {/* Product Title */}
                    <div className="text-center pb-2">
                      <h3 className="text-2xl font-bold">{selectedProduct.title}</h3>
                    </div>

                    {/* Settings Card */}
                    <div className="p-5 bg-muted/30 rounded-lg space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`base-${selectedProduct.id}`} className="text-sm font-medium">Base Price</Label>
                        <Input
                          id={`base-${selectedProduct.id}`}
                          type="number"
                          step="0.01"
                          value={basePrice}
                          onChange={(e) => setBasePrice(parseFloat(e.target.value))}
                          className="text-lg"
                        />
                        <p className="text-xs text-muted-foreground">Starting price for algorithm</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`max-${selectedProduct.id}`} className="text-sm font-medium">Max Price</Label>
                        <Input
                          id={`max-${selectedProduct.id}`}
                          type="number"
                          step="0.01"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(parseFloat(e.target.value))}
                          className="text-lg"
                        />
                        <p className="text-xs text-muted-foreground">Maximum allowed price</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cost-${selectedProduct.id}`} className="text-sm font-medium">Cost</Label>
                        <Input
                          id={`cost-${selectedProduct.id}`}
                          type="number"
                          step="0.01"
                          value={cost}
                          onChange={(e) => setCost(parseFloat(e.target.value))}
                          className="text-lg"
                        />
                        <p className="text-xs text-muted-foreground">Your cost per unit</p>
                      </div>
                    </div>

                    <Button onClick={handleSaveSettings} className="w-full" size="lg">
                      Save Settings
                    </Button>
                  </TabsContent>

                  {/* History Tab */}
                  <TabsContent value="history" className="space-y-5">
                    {/* Product Title */}
                    <div className="text-center pb-2">
                      <h3 className="text-2xl font-bold">{selectedProduct.title}</h3>
                    </div>

                    {/* Price History */}
                    <div className="space-y-2">
                      {mockPriceHistory.map((entry, index) => (
                        <div key={index} className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-sm font-medium">${entry.oldPrice.toFixed(2)} → ${entry.newPrice.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">{entry.date}</p>
                            </div>
                            <Badge variant={entry.reason === 'Smart Pricing' ? 'default' : 'secondary'} className="text-xs">
                              {entry.reason}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Revenue: ${entry.revenue.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
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
