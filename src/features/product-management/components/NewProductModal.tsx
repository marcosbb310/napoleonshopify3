// New product modal component
'use client';

import { useState } from 'react';
import { useCreateProduct } from '@/features/pricing-engine';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface NewProductModalProps {
  onProductCreated?: (product: {
    title: string;
    description: string;
    vendor: string;
    productType: string;
    tags: string[];
    basePrice: number;
    cost: number;
    maxPrice: number;
    currentPrice: number;
  }) => void;
}

export function NewProductModal({ onProductCreated }: NewProductModalProps) {
  const [open, setOpen] = useState(false);
  const createProductMutation = useCreateProduct();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    vendor: '',
    productType: '',
    tags: [] as string[],
    basePrice: 0,
    cost: 0,
    maxPrice: 0,
    currentPrice: 0,
    images: [] as { src: string; alt?: string }[],
  });
  const [newTag, setNewTag] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Product title is required');
      return;
    }

    if (formData.basePrice <= 0 || formData.cost <= 0 || formData.maxPrice <= 0 || formData.currentPrice <= 0) {
      toast.error('All prices must be greater than 0');
      return;
    }
    
    try {
      await createProductMutation.mutateAsync({
        title: formData.title,
        description: formData.description,
        vendor: formData.vendor,
        productType: formData.productType,
        tags: formData.tags,
        status: 'active',
        variants: [{
          title: 'Default',
          price: formData.currentPrice.toString(),
          compareAtPrice: formData.maxPrice.toString(),
          sku: `SKU-${Date.now()}`,
          inventoryQuantity: 100,
          weight: 0,
          weightUnit: 'kg',
        }],
        images: formData.images.map(img => ({
          src: img.src,
          alt: img.alt || formData.title,
        })),
      });
      
      onProductCreated?.(formData);
      
      toast.success('Product created successfully!');
      setOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create product');
      console.error('Error creating product:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      vendor: '',
      productType: '',
      tags: [],
      basePrice: 0,
      cost: 0,
      maxPrice: 0,
      currentPrice: 0,
      images: [],
    });
    setNewTag('');
    setImageUrl('');
    setImageAlt('');
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const addImage = () => {
    if (!imageUrl.trim()) return;
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, { src: imageUrl.trim(), alt: imageAlt.trim() || undefined }],
    }));
    setImageUrl('');
    setImageAlt('');
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Product</DialogTitle>
          <DialogDescription>
            Add a new product to your store. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Product Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter product title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                value={formData.vendor}
                onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                placeholder="Enter vendor name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter product description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productType">Product Type</Label>
            <Select value={formData.productType} onValueChange={(value) => setFormData(prev => ({ ...prev, productType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select product type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clothing">Clothing</SelectItem>
                <SelectItem value="accessories">Accessories</SelectItem>
                <SelectItem value="electronics">Electronics</SelectItem>
                <SelectItem value="home">Home & Garden</SelectItem>
                <SelectItem value="beauty">Beauty & Health</SelectItem>
                <SelectItem value="sports">Sports & Outdoors</SelectItem>
                <SelectItem value="books">Books & Media</SelectItem>
                <SelectItem value="toys">Toys & Games</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag"
              />
              <Button type="button" variant="outline" onClick={addTag}>
                Add
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag) => (
                  <div key={tag} className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Images</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL (https://...)"
              />
              <div className="flex gap-2">
                <Input
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder="Alt text (optional)"
                />
                <Button type="button" variant="outline" onClick={addImage}>Add</Button>
              </div>
            </div>
            {formData.images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {formData.images.map((img, idx) => (
                  <div key={`${img.src}-${idx}`} className="flex items-center justify-between border rounded-md p-2">
                    <div className="truncate mr-2 text-sm">
                      {img.src}
                    </div>
                    <button type="button" onClick={() => removeImage(idx)} className="hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="basePrice">Base Price *</Label>
              <Input
                id="basePrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.basePrice || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, basePrice: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost *</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxPrice">Max Price *</Label>
              <Input
                id="maxPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.maxPrice || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, maxPrice: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPrice">Current Price *</Label>
              <Input
                id="currentPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.currentPrice || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, currentPrice: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProductMutation.isPending}>
              {createProductMutation.isPending ? 'Creating...' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
