// Products page - main hub for product management
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  useProducts, 
  type ProductFilter, 
  type ProductWithPricing,
  ProductCard,
  ProductList,
  BulkEditToolbar,
  ProductFilters,
  SelectionBar,
  NewProductModal,
  ProductCardSkeleton,
  ProductListSkeleton,
} from '@/features/product-management';
import type { ViewMode } from '@/shared/types';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { X, Check, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

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

  // Get all products (no loading state for filtering/searching)
  const { products: allProducts, loading, error, refetch } = useProducts();
  const [products, setProducts] = useState<ProductWithPricing[]>([]);
  const [productUpdates, setProductUpdates] = useState<Map<string, Partial<ProductWithPricing['pricing']>>>(new Map());
  const [lastBulkAction, setLastBulkAction] = useState<{
    updates: Map<string, Partial<ProductWithPricing['pricing']>>;
    description: string;
  } | null>(null);

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

  // Check for bulkEdit URL parameter and open dialog if present
  useEffect(() => {
    const bulkEdit = searchParams.get('bulkEdit');
    if (bulkEdit === 'true') {
      setBulkEditOpen(true);
    }
  }, [searchParams]);

  // Filter and sort products locally for instant results
  useEffect(() => {
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
          const tags = product.tags.map(t => t.toLowerCase());
          
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
          if (tags.some(tag => tag === query)) {
            score += 150;
          } else if (tags.some(tag => tag.startsWith(query))) {
            score += 100;
          } else if (tags.some(tag => tag.includes(query))) {
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

    setProducts(filtered);
  }, [allProducts, searchQuery, selectedTags, filter, productUpdates]);

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

  const handleNewProduct = (productData: {
    title: string;
    description: string;
    vendor: string;
    productType: string;
    tags: string[];
    basePrice: number;
    cost: number;
    maxPrice: number;
    currentPrice: number;
  }) => {
    // Product was created successfully via API, refresh the products list
    console.log('New product created:', productData);
    
    // Immediate refetch and short retries to get fresh data from Shopify
    refetch();
    setTimeout(() => refetch(), 2000);
    setTimeout(() => refetch(), 5000);
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      toast.loading('Deleting product...', { id: 'delete-product' });
      
      // Call API to delete product
      const response = await fetch('/api/shopify/products', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productIds: [productId] }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to delete product');
      }

      toast.success('Product deleted successfully!', { id: 'delete-product' });
      
      // Refresh the products list
      refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete product';
      toast.error(message, { id: 'delete-product' });
    }
  };

  const handleBulkDelete = async (productIds: string[]) => {
    try {
      toast.loading(`Deleting ${productIds.length} product(s)...`, { id: 'bulk-delete' });
      
      // Call API to delete products
      const response = await fetch('/api/shopify/products', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productIds }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to delete products');
      }

      toast.success(`${productIds.length} product(s) deleted successfully!`, { id: 'bulk-delete' });
      
      // Clear selection
      setSelectedIds(new Set());
      
      // Refresh the products list
      refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete products';
      toast.error(message, { id: 'bulk-delete' });
    }
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

  const selectedProduct = products.find(p => p.id === showingVariantsForProduct);
  
  const priceRange = selectedProduct && selectedProduct.variants.length > 1 
    ? `$${Math.min(...selectedProduct.variants.map(v => parseFloat(v.price))).toFixed(2)} - $${Math.max(...selectedProduct.variants.map(v => parseFloat(v.price))).toFixed(2)}`
    : selectedProduct ? `$${selectedProduct.variants[0]?.price || '0.00'}` : '';
    
  const totalInventory = selectedProduct ? selectedProduct.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0) : 0;

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            {selectedIds.size === 0 
              ? 'Manage your products and pricing'
              : `${selectedIds.size} product${selectedIds.size > 1 ? 's' : ''} selected`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <NewProductModal onProductCreated={handleNewProduct} />
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
            onBulkDelete={handleBulkDelete}
          />
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear Selection
            </Button>
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
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <p className="text-xs text-muted-foreground">
              Using mock data for demonstration. Check your Shopify credentials in .env.local
            </p>
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
          <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-all duration-300 ${
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
                onDelete={handleDeleteProduct}
                selectedTags={selectedTags}
                onTagClick={handleTagClick}
                onShowVariants={handleShowVariants}
                isShowingVariants={product.id === showingVariantsForProduct}
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
          onDelete={handleDeleteProduct}
        />
      )}

      <SelectionBar
        selectedCount={selectedIds.size}
        onClearSelection={handleClearSelection}
      />
    </div>
  );
}

