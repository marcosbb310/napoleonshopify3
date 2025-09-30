// Product list component for list view
'use client';

import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { TrendingUp, TrendingDown, Edit } from 'lucide-react';
import type { ProductWithPricing } from '../types';

interface ProductListProps {
  products: ProductWithPricing[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onEdit: (product: ProductWithPricing) => void;
}

export function ProductList({ 
  products, 
  selectedIds, 
  onSelect, 
  onSelectAll,
  onEdit 
}: ProductListProps) {
  const allSelected = products.length > 0 && products.every(p => selectedIds.has(p.id));

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
                      <div className="h-10 w-10 rounded bg-muted flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{product.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {product.vendor}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-semibold">
                    ${product.pricing.currentPrice.toFixed(2)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    ${product.pricing.basePrice.toFixed(2)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    ${product.pricing.cost.toFixed(2)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    ${product.pricing.maxPrice.toFixed(2)}
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(product)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
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
