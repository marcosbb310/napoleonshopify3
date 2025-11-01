// Products page - main hub for product management
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { 
  type ProductFilter, 
  type ProductWithPricing,
  ProductCard,
  ProductList,
  BulkEditToolbar,
  ProductFilters,
  SelectionBar,
  ProductCardSkeleton,
  ProductListSkeleton,
} from '@/features/product-management';
import { useProducts, useStores } from '@/features/shopify-integration';
import { 
  useSmartPricing, 
  useUndoState, 
  SmartPricingResumeModal, 
  SmartPricingConfirmDialog,
  UndoButton,
  PowerButton 
} from '@/features/pricing-engine';
import type { ViewMode } from '@/shared/types';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/shared/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { X, Check, Undo2, Zap, ZapOff, Search, DollarSign, TrendingUp, BarChart3, Package, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthenticatedFetch } from '@/shared/lib/apiClient';

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<ProductFilter>({
    sortBy: 'title',
    sortDirection: 'asc',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [showingVariantsForProduct, setShowingVariantsForProduct] = useState<string | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
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

  // Get stores and select the first one if none selected
  const { stores, isLoading: storesLoading } = useStores();
  const authenticatedFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);
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
    setMultipleProductStates 
  } = useSmartPricing();

  // Undo state management
  const { canUndo, formatTimeRemaining, setUndo, executeUndo, undoState } = useUndoState();
  
  // Product updates state - must be declared before useEffect that uses it
  const [productUpdates, setProductUpdates] = useState<Map<string, Partial<ProductWithPricing['pricing']>>>(new Map());

  // Get all products from the selected store
  const { products: shopifyProducts, isLoading: productsLoading, error: productsError, syncProducts } = useProducts(selectedStoreId, {
    search: searchQuery,
    sortBy: filter.sortBy as any,
    sortOrder: filter.sortDirection as any,
  });

  // Transform Shopify products to ProductWithPricing format
  const allProducts: ProductWithPricing[] = useMemo(() => {
    return shopifyProducts.map(product => {
      const firstVariant = product.variants[0];
      const currentPrice = firstVariant ? parseFloat(firstVariant.price) : 0;
      const basePrice = currentPrice;
      const cost = basePrice * 0.6; // Assume 60% cost
      const maxPrice = basePrice * 1.5; // Assume 150% max price
      const profitMargin = basePrice > 0 ? ((basePrice - cost) / basePrice) * 100 : 0;

      // Get pricing config from product metadata
      const pricingConfig = (product as any).pricing_config;
      const autoPricingEnabled = Array.isArray(pricingConfig) 
        ? pricingConfig[0]?.auto_pricing_enabled ?? true
        : pricingConfig?.auto_pricing_enabled ?? true;

      return {
        ...product,
        pricing: {
          basePrice,
          cost,
          maxPrice,
          currentPrice,
          profitMargin,
          lastUpdated: new Date(),
          autoPricingEnabled, // Store the smart pricing state
        },
      };
    });
  }, [shopifyProducts]);

  const loading = productsLoading || storesLoading;
  const error = productsError;
  const refetch = () => {
    if (selectedStoreId) {
      syncProducts.mutate(selectedStoreId);
    }
  };

  // Memoized callback for global toggle to prevent infinite loops
  // NOTE: handleGlobalToggle now reads globalEnabled internally, no need to pass it
  const onGlobalToggle = useCallback(() => {
    handleGlobalToggle();
  }, [handleGlobalToggle]);

  // Set undo state when global snapshots change - no reload needed!
  useEffect(() => {
    if (globalSnapshots && globalSnapshots.length > 0) {
      console.log('🔄 Global snapshots received:', globalSnapshots.length);
      
      const action = globalEnabled ? 'global-on' : 'global-off';
      const description = globalEnabled 
        ? `enabled for ${globalSnapshots.length} products`
        : `disabled for ${globalSnapshots.length} products`;
      
      console.log('💾 Saving undo state:', action, description);
      
      // Save undo state (persists to localStorage)
      setUndo(action, globalSnapshots, description);
      
      // Update product prices in productUpdates (source of truth) - no page reload!
      // This ensures prices persist through filters/searches
      setProductUpdates(prev => {
        const newMap = new Map(prev);
        globalSnapshots.forEach(snapshot => {
          if (snapshot.newPrice !== undefined) {
            console.log(`Updating product ${snapshot.shopifyId} to $${snapshot.newPrice}`);
            const existingUpdates = newMap.get(snapshot.shopifyId) || {};
            newMap.set(snapshot.shopifyId, { 
              ...existingUpdates, 
              currentPrice: snapshot.newPrice 
            });
          }
        });
        return newMap;
      });
      
      // Clear snapshots after processing
      setGlobalSnapshots(null);
    }
  }, [globalSnapshots, globalEnabled, setUndo, setProductUpdates, setGlobalSnapshots]);
  const [lastBulkAction, setLastBulkAction] = useState<{
    updates: Map<string, Partial<ProductWithPricing['pricing']>>;
    description: string;
  } | null>(null);

  // Apply any pending updates to products - memoized to prevent recreation
  const applyUpdatesToProducts = useCallback((productList: ProductWithPricing[]) => {
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
  }, [productUpdates]);

  // Check for bulkEdit URL parameter and open dialog if present
  useEffect(() => {
    const bulkEdit = searchParams.get('bulkEdit');
    if (bulkEdit === 'true') {
      setBulkEditOpen(true);
    }
  }, [searchParams]);

  // Filter and sort products - compute on every render like products-test2 to avoid useEffect loops
  const products = useMemo(() => {
    let filtered = applyUpdatesToProducts([...allProducts]);

    // Apply advanced filters first
    if (filter.priceMin !== undefined || filter.priceMax !== undefined) {
      filtered = filtered.filter(product => {
        const price = product.pricing.currentPrice;
        const min = filter.priceMin ?? 0;
        const max = filter.priceMax ?? Infinity;
        return price >= min && price <= max;
      });
    }

    if (filter.marginMin !== undefined || filter.marginMax !== undefined) {
      filtered = filtered.filter(product => {
        const margin = product.pricing.profitMargin;
        const min = filter.marginMin ?? 0;
        const max = filter.marginMax ?? 100;
        return margin >= min && margin <= max;
      });
    }

    if (filter.vendors && filter.vendors.length > 0) {
      filtered = filtered.filter(product => 
        filter.vendors!.includes(product.vendor)
      );
    }

    if (filter.productTypes && filter.productTypes.length > 0) {
      filtered = filtered.filter(product => 
        filter.productTypes!.includes(product.productType)
      );
    }

    // Apply tag filter
    if (selectedTags.size > 0) {
      filtered = filtered.filter(product => 
        product.tags.some(tag => selectedTags.has(tag))
      );
    }

    // Apply search filter with ranking
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      
      // Create array with relevance scores
      const scoredProducts = allProducts
        .map(product => {
          const title = product.title.toLowerCase();
          const vendor = product.vendor.toLowerCase();
          const productType = product.productType.toLowerCase();
          const tags = product.tags.map((t: string) => t.toLowerCase());
          
          let score = 0;
          
          // Title scoring (use if/else to get only the highest match)
          if (title === query) {
            score += 1000;
          } else if (title.startsWith(query)) {
            score += 500;
          } else if (title.includes(` ${query} `) || title.includes(` ${query}`) || title.includes(`${query} `)) {
            score += 300;
          } else if (title.includes(query)) {
            score += 200;
          }
          
          // Tag scoring (independent of title)
          if (tags.some((tag: string) => tag === query)) {
            score += 150;
          } else if (tags.some((tag: string) => tag.startsWith(query))) {
            score += 100;
          } else if (tags.some((tag: string) => tag.includes(query))) {
            score += 75;
          }
          
          // Product type scoring (independent)
          if (productType === query) {
            score += 120;
          } else if (productType.startsWith(query)) {
            score += 80;
          } else if (productType.includes(query)) {
            score += 50;
          }
          
          // Vendor scoring (independent)
          if (vendor === query) {
            score += 100;
          } else if (vendor.startsWith(query)) {
            score += 70;
          } else if (vendor.includes(query)) {
            score += 40;
          }
          
          return { product, score };
        })
        .filter(item => item.score > 0) // Only keep products with matches
        .sort((a, b) => b.score - a.score) // Sort by relevance score
        .map(item => item.product); // Extract products
      
      filtered = scoredProducts;
    }

    // Apply additional sorting only if no search query
    if (!searchQuery.trim()) {
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
          case 'sales':
            // For now, sort by inventory (higher = more popular)
            comparison = (b.variants[0]?.inventoryQuantity || 0) - (a.variants[0]?.inventoryQuantity || 0);
            break;
        }

        return filter.sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [allProducts, searchQuery, selectedTags, filter, applyUpdatesToProducts]);

  const handleUpdatePricing = (productId: string, pricing: { basePrice?: number; cost?: number; maxPrice?: number; currentPrice?: number }) => {
    console.log('Updating pricing for product:', productId, pricing);
    
    // Update the updates map
    setProductUpdates(prev => {
      const newMap = new Map(prev);
      const existingUpdates = newMap.get(productId) || {};
      newMap.set(productId, { ...existingUpdates, ...pricing });
      return newMap;
    });

    // TODO: Call Shopify API to update product pricing
    // await shopifyClient.updateProductPrice(productId, pricing);
  };

  const handleBulkUpdate = (updates: {
    type: 'percentage' | 'fixed';
    value: number;
    applyTo: 'basePrice' | 'maxPrice' | 'cost' | 'currentPrice';
    productIds: string[];
  }) => {
    console.log('handleBulkUpdate called in page:', updates);

    // Store previous state for undo
    const previousUpdates = new Map(productUpdates);

    // Find the current products and calculate new values
    setProductUpdates(prev => {
      const newMap = new Map(prev);
      
      // Get the current products to calculate from their current values
      const currentProducts = applyUpdatesToProducts([...allProducts]);
      
      // If no productIds specified, apply to ALL products
      const targetProductIds = updates.productIds.length === 0 
        ? currentProducts.map(p => p.id)
        : updates.productIds;
      
      console.log(`Applying to ${targetProductIds.length} products (${updates.productIds.length === 0 ? 'ALL' : 'SELECTED'})`);
      
      targetProductIds.forEach(productId => {
        const product = currentProducts.find(p => p.id === productId);
        if (!product) return;
        
        const existingUpdates = newMap.get(productId) || {};
        const currentPricing = { ...product.pricing, ...existingUpdates };
        const currentValue = currentPricing[updates.applyTo];

        // Calculate new value based on type
        let newValue: number;
        if (updates.type === 'percentage') {
          newValue = currentValue * (1 + updates.value / 100);
        } else {
          newValue = currentValue + updates.value;
        }

        // Ensure value is positive
        newValue = Math.max(0.01, newValue);
        
        console.log(`Updating ${productId} ${updates.applyTo} from ${currentValue.toFixed(2)} to ${newValue.toFixed(2)}`);
        
        newMap.set(productId, {
          ...existingUpdates,
          [updates.applyTo]: newValue,
        });
      });
      
      return newMap;
    });

    // Create description for undo
    const field = updates.applyTo === 'basePrice' ? 'Base Price' : updates.applyTo === 'maxPrice' ? 'Max Price' : 'Cost';
    const change = updates.type === 'percentage' 
      ? `${updates.value > 0 ? '+' : ''}${updates.value}%`
      : `${updates.value > 0 ? '+' : ''}$${updates.value}`;
    const targetCount = updates.productIds.length === 0 ? allProducts.length : updates.productIds.length;
    const description = `${field} ${change} on ${targetCount} product${targetCount > 1 ? 's' : ''}`;

    // Store for undo
    setLastBulkAction({
      updates: previousUpdates,
      description,
    });

    // Show success toast
    toast.success('Bulk update applied!', {
      description: description,
    });

    // TODO: Call Shopify API to bulk update product pricing
    // await shopifyClient.bulkUpdateProductPrices(updates);
  };

  const handleUndo = () => {
    if (!lastBulkAction) return;

    setProductUpdates(lastBulkAction.updates);
    toast.success('Changes undone', {
      description: `Reverted: ${lastBulkAction.description}`,
    });
    setLastBulkAction(null);
  };


  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleToggleSmartPricing = (enable: boolean) => {
    // Update state for all selected products
    setMultipleProductStates(Array.from(selectedIds), enable);

    // TODO: Call API to enable/disable smart pricing for selected products
    console.log(`${enable ? 'Enabling' : 'Disabling'} smart pricing for products:`, Array.from(selectedIds));
    
    toast.success(`Smart pricing ${enable ? 'enabled' : 'disabled'} for ${selectedIds.size} product${selectedIds.size > 1 ? 's' : ''}`, {
      description: enable 
        ? 'Algorithm will start optimizing prices for selected products'
        : 'Prices will remain at current values until re-enabled',
    });
  };

  const handleProductSmartPricingToggle = (productId: string, enabled: boolean, newPrice?: number) => {
    setProductState(productId, enabled);

    // Update product price in allProducts (source of truth) if provided
    // This ensures the price persists through filters/searches
    if (newPrice !== undefined) {
      // Store in productUpdates so it persists
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

  const handleShowVariants = (productId: string) => {
    setShowingVariantsForProduct(productId);
  };

  const handleCloseVariants = () => {
    setShowingVariantsForProduct(null);
  };

  const handleViewAnalytics = (productId: string) => {
    console.log('🔍 handleViewAnalytics called with:', productId);
    console.log('🔍 ProductId type:', typeof productId);
    console.log('🔍 ProductId length:', productId?.length);
    console.log('🔍 Total filtered products:', products.length);
    console.log('🔍 Total all products:', allProducts.length);
    
    // Debug: show first few product IDs for comparison
    if (products.length > 0) {
      console.log('🔍 Sample filtered product IDs:', products.slice(0, 3).map(p => ({ id: p.id, type: typeof p.id, length: p.id?.length })));
    }
    if (allProducts.length > 0) {
      console.log('🔍 Sample all product IDs:', allProducts.slice(0, 3).map(p => ({ id: p.id, type: typeof p.id, length: p.id?.length })));
    }
    
    // First try to find in filtered products array
    let product = products.find(p => p.id === productId);
    console.log('🔍 Search result in filtered array:', !!product);
    
    // If not found, search in all products (might be filtered out)
    if (!product) {
      console.log('⚠️ Product not in filtered array, searching in all products...');
      product = allProducts.find(p => p.id === productId);
      console.log('🔍 Search result in all products:', !!product);
    }
    
    if (product) {
      console.log('✅ Opening analytics modal for:', product.title);
      setSelectedProductId(productId);
      setBasePrice(product.pricing.basePrice);
      setMaxPrice(product.pricing.maxPrice);
      setCost(product.pricing.cost);
      // Reset editing state when opening modal
      setEditingQuickField(null);
      // Fetch performance data
      fetchPerformanceData(productId);
    } else {
      console.error('❌ Product not found with ID:', productId);
      console.error('❌ Requested ID type:', typeof productId, 'length:', productId?.length);
      console.error('❌ First 5 IDs in filtered products:', products.slice(0, 5).map(p => ({ id: p.id, type: typeof p.id })));
      console.error('❌ First 5 IDs in all products:', allProducts.slice(0, 5).map(p => ({ id: p.id, type: typeof p.id })));
      toast.error('Product not found. It may have been removed or filtered.');
    }
  };

  // Fetch performance data for selected product
  const fetchPerformanceData = async (productId: string) => {
    console.log('Fetching performance for product:', productId);
    setLoadingPerformance(true);
    try {
      const response = await fetch(`/api/products/${productId}/performance`);
      console.log('Performance API response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        
        if (response.status === 404) {
          console.error('Product not found in database:', productId);
          toast.error('Product data not found in database. Try syncing your products first.');
        } else {
          console.error('API error:', errorMessage);
          toast.error(`Failed to fetch performance data: ${errorMessage}`);
        }
        setPerformanceData(null);
        return;
      }
      
      const result = await response.json();
      console.log('Performance API result:', result);
      
      if (result.success && result.data) {
        setPerformanceData(result.data);
      } else {
        console.error('Failed to fetch performance data:', result.error);
        toast.error(result.error || 'Failed to fetch performance data');
        setPerformanceData(null);
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error loading performance data: ${errorMessage}`);
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
    if (!editingQuickField || !selectedProductId || !selectedStoreId) return;
    
    const newValue = parseFloat(quickEditValue);
    if (isNaN(newValue) || newValue <= 0) {
      toast.error('Invalid price', { description: 'Please enter a valid positive number' });
      return;
    }

    // Only call API for currentPrice (actual Shopify price)
    // basePrice and maxPrice are local settings only
    if (editingQuickField === 'currentPrice') {
      // Show loading toast
      const loadingToast = toast.loading('Updating price...');

      try {
        // Call API to update Shopify and database
        const response = await fetch(`/api/shopify/products/${selectedProductId}/price`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            price: newValue,
            field: editingQuickField 
          }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to update price');
        }

        toast.dismiss(loadingToast);
        toast.success('Price updated in Shopify!');

        // Update local state
        setProductUpdates(prev => {
          const newMap = new Map(prev);
          const existingUpdates = newMap.get(selectedProductId) || {};
          newMap.set(selectedProductId, { 
            ...existingUpdates, 
            currentPrice: newValue 
          });
          return newMap;
        });

        // Invalidate queries to refetch from database
        queryClient.invalidateQueries({ queryKey: ['products', selectedStoreId] });
        
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error('Failed to update price', {
          description: error instanceof Error ? error.message : 'Unknown error'
        });
        return; // Don't continue if API call failed
      }
    } else {
      // For basePrice and maxPrice, just update local state
      if (editingQuickField === 'basePrice') {
        setBasePrice(newValue);
      } else if (editingQuickField === 'maxPrice') {
        setMaxPrice(newValue);
      }
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

    setEditingQuickField(null);
    
    if (editingQuickField !== 'currentPrice') {
      toast.success('Price updated');
    }
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

  // Mock price history
  const mockPriceHistory = [
    { date: 'Jan 15, 2025', oldPrice: 52.0, newPrice: 49.99, reason: 'Smart Pricing', revenue: 1250 },
    { date: 'Jan 10, 2025', oldPrice: 55.0, newPrice: 52.0, reason: 'Smart Pricing', revenue: 890 },
    { date: 'Jan 05, 2025', oldPrice: 50.0, newPrice: 55.0, reason: 'Smart Pricing', revenue: 1100 },
  ];

  const selectedProduct = products.find(p => p.id === showingVariantsForProduct);
  const selectedAnalyticsProduct = selectedProductId ? products.find(p => p.id === selectedProductId) : null;
  
  console.log('🔍 selectedProductId:', selectedProductId);
  console.log('🔍 selectedAnalyticsProduct:', selectedAnalyticsProduct?.title);
  
  const priceRange = selectedProduct && selectedProduct.variants.length > 1 
    ? `$${Math.min(...selectedProduct.variants.map(v => parseFloat(v.price))).toFixed(2)} - $${Math.max(...selectedProduct.variants.map(v => parseFloat(v.price))).toFixed(2)}`
    : selectedProduct ? `$${selectedProduct.variants[0]?.price || '0.00'}` : '';
    
  const totalInventory = selectedProduct ? selectedProduct.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0) : 0;

  // Show store selection if no store is selected
  if (stores.length === 0 && !storesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground">Manage your products and pricing</p>
          </div>
        </div>
        <Card className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium">No stores connected</p>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Shopify store to start managing products
            </p>
            <Link href="/settings?tab=integrations">
              <Button>Connect Store</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            
            {/* Run Pricing Now Button - MUST BE VISIBLE */}
            <Button
              onClick={async () => {
                if (!selectedStoreId) {
                  toast.error('Please select a store first');
                  return;
                }
                const t = toast.loading('Running pricing algorithm...');
                try {
                  const res = await authenticatedFetch('/api/pricing/run', { method: 'POST' });
                  const result = await res.json();
                  toast.dismiss(t);
                  
                  if (res.ok && result.success) {
                    // Check if algorithm was skipped due to global toggle being disabled
                    if (result.skipped) {
                      toast.info('Pricing algorithm skipped', {
                        description: result.message || 'Global smart pricing is disabled. Enable it to run pricing.',
                        duration: 5000,
                      });
                    } else {
                      const s = result.stats || {};
                      // Check if any products were actually processed
                      if (s.processed === 0) {
                        toast.info('Pricing run completed', {
                          description: result.message || 'No products were processed',
                          duration: 5000,
                        });
                      } else {
                        toast.success('Pricing run completed!', {
                          description: `Processed: ${s.processed || 0}, Increased: ${s.increased || 0}, Reverted: ${s.reverted || 0}`,
                          duration: 5000,
                        });
                        syncProducts.mutate(selectedStoreId);
                      }
                    }
                  } else {
                    toast.error('Pricing run failed', { description: result.error || result.message || 'Unknown error' });
                  }
                } catch (e) {
                  toast.dismiss(t);
                  toast.error('Pricing run failed', { description: e instanceof Error ? e.message : 'Unknown error' });
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-md shadow-lg border-0"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <BarChart3 style={{ width: '16px', height: '16px' }} />
              Run Pricing Now
            </Button>
            
            {/* Store Selector */}
            {stores.length > 1 && (
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.shop_domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Test Layout Links */}
            <div className="flex items-center gap-2">
              <Link href="/products-test">
                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent">
                  🧪 Accordion
                </Badge>
              </Link>
              <Link href="/products-test2">
                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent">
                  🧪 Slide-out
                </Badge>
              </Link>
            </div>
            {/* Sync Products Button */}
            <Button
              onClick={() => {
                if (selectedStoreId) {
                  const loadingToast = toast.loading('Syncing products from Shopify...');
                  syncProducts.mutate(selectedStoreId, {
                    onSuccess: (data) => {
                      toast.dismiss(loadingToast);
                      if (data?.success) {
                        toast.success(`Synced ${data.data?.syncedProducts || 0} products!`);
                      } else {
                        toast.error(data?.error || 'Sync failed');
                      }
                    },
                    onError: (error) => {
                      toast.dismiss(loadingToast);
                      toast.error(`Sync failed: ${error.message}`);
                    }
                  });
                } else {
                  toast.error('Please select a store first');
                }
              }}
              disabled={productsLoading || syncProducts.isPending}
              variant="outline"
              className="gap-2"
            >
              <Package className="h-4 w-4" />
              {syncProducts.isPending ? 'Syncing...' : 'Sync Products'}
            </Button>
            
            {/* Test Sync Button */}
            <Button
              onClick={async () => {
                if (selectedStoreId) {
                  toast.loading('Running diagnostics...');
                  try {
                    const response = await fetch('/api/shopify/test-sync', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ storeId: selectedStoreId }),
                    });
                    const result = await response.json();
                    toast.dismiss();
                    
                    if (result.success) {
                      toast.success('Diagnostics passed!', {
                        description: `Shopify: ${result.diagnostic.productsInShopify} products, Database: ${result.diagnostic.productsInDatabase}`,
                      });
                      console.log('📊 Full diagnostic:', result);
                    } else {
                      toast.error(`Diagnostic failed at ${result.step}`, {
                        description: result.error,
                      });
                      console.error('❌ Diagnostic error:', result);
                    }
                  } catch (error) {
                    toast.dismiss();
                    toast.error('Failed to run diagnostics');
                    console.error('Diagnostic error:', error);
                  }
                } else {
                  toast.error('Please select a store first');
                }
              }}
              variant="outline"
              size="sm"
              title="Test Sync Connection"
              className="gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Test</span>
            </Button>
            
            {/* Global Smart Pricing Toggle */}
            <PowerButton 
              enabled={globalEnabled}
              onToggle={onGlobalToggle}
              disabled={isLoadingGlobal}
              label="Global Smart Pricing"
            />
            {/* Undo Button */}
            {canUndo && (
              <UndoButton
                onClick={async () => {
                  const result = await executeUndo();
                  if (result.success) {
                    toast.success(`Undone: ${undoState?.description}`);
                    // Prices will be refreshed automatically via React Query cache invalidation
                    refetch(); // Force refetch to ensure prices are up-to-date
                  } else {
                    toast.error('Failed to undo');
                  }
                }}
                description={undoState?.description || ''}
                timeRemaining={formatTimeRemaining()}
              />
            )}
          </div>
          <p className="text-muted-foreground">
            {selectedIds.size === 0 
              ? 'Manage your products and pricing'
              : `${selectedIds.size} product${selectedIds.size > 1 ? 's' : ''} selected`
            }
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex gap-2">
            {lastBulkAction && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleUndo}
              >
                <Undo2 className="h-4 w-4" />
                Undo Last Change
              </Button>
            )}
            <BulkEditToolbar 
              selectedCount={selectedIds.size} 
              selectedIds={Array.from(selectedIds)}
              totalProductCount={allProducts.length}
              open={bulkEditOpen}
              onOpenChange={setBulkEditOpen}
              onBulkUpdate={handleBulkUpdate}
            />
          </div>
        </div>
      </div>

      <ProductFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filter={filter}
        onFilterChange={setFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        allProducts={allProducts}
      />

      {/* Select All Button for filtered products */}
      {!loading && products.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="gap-2"
            >
              {selectedIds.size === products.length ? (
                <>
                  <X className="h-4 w-4" />
                  Deselect All ({products.length})
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Select All ({products.length})
                </>
              )}
            </Button>
            {selectedIds.size > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} of {products.length} products selected
              </span>
            )}
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              {(() => {
                // Check if any selected products have smart pricing enabled
                const selectedProducts = Array.from(selectedIds);
                const allEnabled = selectedProducts.every(id => isProductEnabled(id));
                
                return (
                  <Button
                    variant={allEnabled ? "outline" : "default"}
                    size="sm"
                    onClick={() => handleToggleSmartPricing(!allEnabled)}
                    className="gap-2"
                  >
                    {allEnabled ? (
                      <>
                        <ZapOff className="h-4 w-4" />
                        Turn Off Smart Pricing
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Turn On Smart Pricing
                      </>
                    )}
                  </Button>
                );
              })()}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear Selection
              </Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <ProductListSkeleton key={i} />
              ))}
            </div>
          )}
        </div>
      ) : error ? (
        <Card className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-destructive">Failed to load products</p>
            <p className="text-sm text-muted-foreground mb-4">{error instanceof Error ? error.message : String(error)}</p>
            {(error instanceof Error ? error.message : String(error)).includes('403') || (error instanceof Error ? error.message : String(error)).includes('Forbidden') ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Your Shopify access token may be invalid or expired.
                </p>
                <Link href="/settings">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="mt-4"
                  >
                    Reconnect Store
                  </Button>
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground">
                  Please check your store connection and try refreshing the page.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : products.length === 0 ? (
        <Card className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium">No products found</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or search terms
            </p>
          </div>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="relative">
          {/* Backdrop overlay */}
          {showingVariantsForProduct && (
            <div 
              className="fixed inset-0 bg-black/60 z-40 animate-in fade-in duration-300"
              onClick={handleCloseVariants}
            />
          )}
          
          {/* Products Grid */}
          <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr transition-all duration-300 ${
            showingVariantsForProduct ? 'opacity-40 pointer-events-none' : ''
          }`}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isSelected={selectedIds.has(product.id)}
                onSelect={handleSelect}
                onEdit={() => console.log('Edit product:', product)}
                onUpdatePricing={handleUpdatePricing}
                selectedTags={selectedTags}
                onTagClick={handleTagClick}
                onShowVariants={handleShowVariants}
                isShowingVariants={product.id === showingVariantsForProduct}
                smartPricingEnabled={isProductEnabled(product.id)}
                onSmartPricingToggle={(enabled, newPrice) => handleProductSmartPricingToggle(product.id, enabled, newPrice)}
                onViewAnalytics={(id) => {
                  console.log('🚀 onViewAnalytics clicked for product ID:', id);
                  handleViewAnalytics(id);
                }}
                globalSmartPricingEnabled={globalEnabled}
              />
            ))}
          </div>

          {/* Variant Panel - slides from the selected card */}
          {showingVariantsForProduct && selectedProduct && (
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-4xl animate-in slide-in-from-right duration-300">
              <div className="bg-background border-2 border-primary rounded-lg shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">{selectedProduct.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedProduct.variants.length} variants • {priceRange} • {totalInventory} total stock
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCloseVariants}
                    className="hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedProduct.variants.map((variant) => (
                    <div 
                      key={variant.id} 
                      className="border rounded-lg p-4 hover:border-primary/40 transition-colors bg-card"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">{variant.title}</h4>
                          <p className="text-xs text-muted-foreground">SKU: {variant.sku}</p>
                        </div>
                        <Badge 
                          variant={
                            (variant.inventoryQuantity || 0) < 10 ? 'destructive' : 
                            (variant.inventoryQuantity || 0) < 20 ? 'secondary' : 
                            'default'
                          }
                          className="text-xs"
                        >
                          {variant.inventoryQuantity || 0} in stock
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Price</p>
                          <p className="font-bold text-primary">${variant.price}</p>
                          {variant.compareAtPrice && parseFloat(variant.compareAtPrice) > parseFloat(variant.price) && (
                            <p className="text-xs line-through text-muted-foreground">
                              Was ${variant.compareAtPrice}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Weight</p>
                          <p className="font-semibold">
                            {variant.weight ? `${variant.weight}${variant.weightUnit || 'g'}` : 'Not set'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ProductList
          products={products}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          onEdit={(product) => console.log('Edit product:', product)}
          onUpdatePricing={handleUpdatePricing}
          isProductEnabled={isProductEnabled}
          onSmartPricingToggle={handleProductSmartPricingToggle}
        />
      )}

      <SelectionBar
        selectedCount={selectedIds.size}
        onClearSelection={handleClearSelection}
      />

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

      {/* Right-Side Analytics Panel (Sheet) */}
      <Sheet open={!!selectedProductId} onOpenChange={(open) => {
        console.log('📊 Sheet onOpenChange:', open, 'selectedProductId:', selectedProductId);
        if (!open) setSelectedProductId(null);
      }}>
        <SheetContent 
          side="right" 
          className="w-full sm:!max-w-[500px] overflow-y-auto p-0 transition-all duration-700 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-1/2 data-[state=open]:slide-in-from-right-1/2 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          {selectedAnalyticsProduct && (
            <>
              {/* Header with Product Image */}
              <div className="relative h-48 bg-gradient-to-br from-muted to-muted/50">
                {selectedAnalyticsProduct.images[0] && (
                  <>
                    <Image
                      src={selectedAnalyticsProduct.images[0].src}
                      alt={selectedAnalyticsProduct.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/75" />
                  </>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <SheetTitle className="text-2xl mb-1 text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                    {selectedAnalyticsProduct.title}
                  </SheetTitle>
                  <SheetDescription className="text-white/90" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                    {selectedAnalyticsProduct.vendor} • {selectedAnalyticsProduct.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0)} in stock
                  </SheetDescription>
                </div>
              </div>

              <div className="p-6">
                {/* Smart Pricing Toggle - Prominent at top */}
                <div className="mb-6 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className={`h-5 w-5 ${isProductEnabled(selectedAnalyticsProduct.id) ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <p className="font-semibold">Smart Pricing</p>
                        <p className="text-xs text-muted-foreground">
                          {isProductEnabled(selectedAnalyticsProduct.id) ? 'Active - Auto-adjusting price' : 'Disabled - Using base price'}
                        </p>
                      </div>
                    </div>
                    <Switch 
                      checked={isProductEnabled(selectedAnalyticsProduct.id)}
                      onCheckedChange={(checked) => handleProductSmartPricingToggle(selectedAnalyticsProduct.id, checked)}
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
                              <span className="text-2xl font-bold">${selectedAnalyticsProduct.pricing.basePrice.toFixed(2)}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartQuickEdit('basePrice', selectedAnalyticsProduct.pricing.basePrice)}
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
                              <span className="text-3xl font-bold text-primary">${selectedAnalyticsProduct.pricing.currentPrice.toFixed(2)}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartQuickEdit('currentPrice', selectedAnalyticsProduct.pricing.currentPrice)}
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
                              <span className="text-2xl font-bold">${selectedAnalyticsProduct.pricing.maxPrice.toFixed(2)}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartQuickEdit('maxPrice', selectedAnalyticsProduct.pricing.maxPrice)}
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Maximum price ceiling for algorithm</p>
                      </div>

                      {/* Profit Margin */}
                      <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">Profit Margin</span>
                          <span className="text-2xl font-bold text-green-600">
                            {(((selectedAnalyticsProduct.pricing.currentPrice - selectedAnalyticsProduct.pricing.cost) / selectedAnalyticsProduct.pricing.currentPrice) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Profit: ${(selectedAnalyticsProduct.pricing.currentPrice - selectedAnalyticsProduct.pricing.cost).toFixed(2)} per unit
                        </p>
                      </div>
                    </div>

                    {/* Variants List */}
                    {selectedAnalyticsProduct.variants.length > 1 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Variants ({selectedAnalyticsProduct.variants.length})</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedAnalyticsProduct.variants.map((variant) => (
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
                    {loadingPerformance ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-3 text-muted-foreground">Loading performance data...</span>
                      </div>
                    ) : performanceData && (performanceData.summary as Record<string, unknown>) ? (
                      <>
                        {/* Smart Pricing Impact */}
                        <div className="p-5 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-950/10 rounded-lg border-2 border-green-200 dark:border-green-900">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                            <h4 className="font-semibold text-lg">Smart Pricing Impact</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Revenue Increase</p>
                              <p className="text-3xl font-bold text-green-600">
                                {((performanceData.summary as Record<string, unknown>).revenueIncreasePercent as number || 0).toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                              <p className="text-3xl font-bold">${((performanceData.summary as Record<string, unknown>).totalRevenue as number || 0).toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center bg-muted/30 rounded-lg">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No performance data available</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Performance metrics will appear once smart pricing makes changes
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="space-y-5">
                    <div className="p-5 bg-muted/30 rounded-lg space-y-4">
                      <div className="space-y-2">
                        <Label>Base Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={basePrice}
                          onChange={(e) => setBasePrice(parseFloat(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(parseFloat(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={cost}
                          onChange={(e) => setCost(parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                    <Button onClick={handleSaveSettings} className="w-full" size="lg">
                      Save Settings
                    </Button>
                  </TabsContent>

                  {/* History Tab */}
                  <TabsContent value="history" className="space-y-5">
                    <div className="space-y-2">
                      {mockPriceHistory.map((entry, index) => (
                        <div key={index} className="p-4 bg-muted/30 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-sm font-medium">${entry.oldPrice} → ${entry.newPrice}</p>
                              <p className="text-xs text-muted-foreground">{entry.date}</p>
                            </div>
                            <Badge variant={entry.reason === 'Smart Pricing' ? 'default' : 'secondary'}>
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
    </div>
  );
}

