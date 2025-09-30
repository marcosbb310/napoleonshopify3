// Product filters and search component
'use client';

import { useState } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Badge } from '@/shared/components/ui/badge';
import { Search, SlidersHorizontal, Grid, List, X } from 'lucide-react';
import type { ProductFilter } from '../types';
import type { ViewMode } from '@/shared/types';

interface ProductFiltersProps {
  searchQuery: string;
  onSearchChange: (search: string) => void;
  filter: ProductFilter;
  onFilterChange: (filter: ProductFilter) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  allProducts: Array<{ vendor: string; productType: string; pricing: { currentPrice: number; profitMargin: number } }>;
}

export function ProductFilters({
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  viewMode,
  onViewModeChange,
  allProducts,
}: ProductFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [marginRange, setMarginRange] = useState<[number, number]>([0, 100]);
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  // Get unique vendors and product types
  const vendors = Array.from(new Set(allProducts.map(p => p.vendor))).sort();
  const productTypes = Array.from(new Set(allProducts.map(p => p.productType))).sort();

  const handleApplyFilters = () => {
    onFilterChange({
      ...filter,
      priceMin: priceRange[0],
      priceMax: priceRange[1],
      marginMin: marginRange[0],
      marginMax: marginRange[1],
      vendors: selectedVendors.size > 0 ? Array.from(selectedVendors) : undefined,
      productTypes: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined,
    });
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setPriceRange([0, 500]);
    setMarginRange([0, 100]);
    setSelectedVendors(new Set());
    setSelectedTypes(new Set());
    onFilterChange({
      sortBy: filter.sortBy,
      sortDirection: filter.sortDirection,
    });
  };

  const activeFiltersCount = 
    (filter.priceMin !== undefined || filter.priceMax !== undefined ? 1 : 0) +
    (filter.marginMin !== undefined || filter.marginMax !== undefined ? 1 : 0) +
    (filter.vendors && filter.vendors.length > 0 ? filter.vendors.length : 0) +
    (filter.productTypes && filter.productTypes.length > 0 ? filter.productTypes.length : 0);

  const toggleVendor = (vendor: string) => {
    setSelectedVendors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vendor)) {
        newSet.delete(vendor);
      } else {
        newSet.add(vendor);
      }
      return newSet;
    });
  };

  const toggleProductType = (type: string) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={filter.sortBy || 'title'}
            onValueChange={(value) =>
              onFilterChange({ ...filter, sortBy: value as 'title' | 'price' | 'updated' | 'sales' })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Name</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="updated">Recently Updated</SelectItem>
              <SelectItem value="sales">Top Sellers</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filter.sortDirection || 'asc'}
            onValueChange={(value) =>
              onFilterChange({ ...filter, sortDirection: value as 'asc' | 'desc' })
            }
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => onViewModeChange('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => onViewModeChange('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Dialog open={showFilters} onOpenChange={setShowFilters}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFiltersCount > 0 && (
                  <Badge 
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-primary"
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Advanced Filters</DialogTitle>
                <DialogDescription>
                  Filter products by price, profit margin, vendor, and type
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Price Range */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Price Range</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Min: ${priceRange[0]}</Label>
                    </div>
                    <div className="flex-1 text-right">
                      <Label className="text-xs text-muted-foreground">Max: ${priceRange[1]}</Label>
                    </div>
                  </div>
                  <Slider
                    min={0}
                    max={500}
                    step={10}
                    value={priceRange}
                    onValueChange={(value) => setPriceRange(value as [number, number])}
                    className="py-4"
                  />
                </div>

                {/* Profit Margin Range */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Profit Margin</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Min: {marginRange[0]}%</Label>
                    </div>
                    <div className="flex-1 text-right">
                      <Label className="text-xs text-muted-foreground">Max: {marginRange[1]}%</Label>
                    </div>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={marginRange}
                    onValueChange={(value) => setMarginRange(value as [number, number])}
                    className="py-4"
                  />
                </div>

                {/* Vendors */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Vendors</Label>
                  <div className="flex flex-wrap gap-2">
                    {vendors.map(vendor => (
                      <Badge
                        key={vendor}
                        variant="outline"
                        className={`cursor-pointer transition-all ${
                          selectedVendors.has(vendor)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => toggleVendor(vendor)}
                      >
                        {vendor}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Product Types */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Product Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {productTypes.map(type => (
                      <Badge
                        key={type}
                        variant="outline"
                        className={`cursor-pointer transition-all ${
                          selectedTypes.has(type)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => toggleProductType(type)}
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handleClearFilters}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                  <Button
                    onClick={handleApplyFilters}
                    className="flex-1"
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
