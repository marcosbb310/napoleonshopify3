'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useShopValidation } from '../hooks/useShopValidation';
import type { ShopDomainInputProps } from '../types';

/**
 * Shop Domain Input Component
 * 
 * Features:
 * - Real-time validation with debouncing
 * - Visual feedback (checkmark/error)
 * - Auto-format (.myshopify.com)
 * - Helpful error messages
 */
export function ShopDomainInput({
  value,
  onChange,
  onValidation,
  disabled,
  autoFocus,
}: ShopDomainInputProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  // Debounce input (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, 500);

    return () => clearTimeout(timer);
  }, [value]);

  // Validate debounced value
  const { data: validation, isLoading } = useShopValidation(
    debouncedValue,
    debouncedValue.length > 3
  );

  // Notify parent of validation result
  useEffect(() => {
    if (validation && onValidation) {
      onValidation(validation);
    }
  }, [validation, onValidation]);

  const showValidation = debouncedValue.length > 3 && !isLoading;
  const isValid = validation?.isValid;
  const hasError = showValidation && !isValid;

  return (
    <div className="space-y-2">
      <Label htmlFor="shop-domain">Shopify Store Domain</Label>
      
      <div className="relative">
        <Input
          id="shop-domain"
          type="text"
          placeholder="mystore.myshopify.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`pr-10 ${
            isValid ? 'border-green-500 focus-visible:ring-green-500' :
            hasError ? 'border-red-500 focus-visible:ring-red-500' :
            ''
          }`}
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {showValidation && isValid && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          {hasError && (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>
      </div>

      {hasError && validation?.error && (
        <div className="space-y-1">
          <p className="text-sm text-red-500">{validation.error}</p>
          {validation.suggestion && (
            <p className="text-xs text-muted-foreground">{validation.suggestion}</p>
          )}
        </div>
      )}

      {showValidation && isValid && (
        <p className="text-sm text-green-600">✓ Store found and ready to connect</p>
      )}
    </div>
  );
}
