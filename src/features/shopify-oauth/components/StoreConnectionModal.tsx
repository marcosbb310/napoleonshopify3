'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { ShopDomainInput } from './ShopDomainInput';
import { PermissionPreview } from './PermissionPreview';
import { OAuthProgress } from './OAuthProgress';
import { ConnectionSuccess } from './ConnectionSuccess';
import { Button } from '@/shared/components/ui/button';
import { useOAuthFlow } from '../hooks/useOAuthFlow';
import type { StoreConnectionModalProps, ValidationResult } from '../types';

/**
 * Store Connection Modal
 * 
 * Multi-step modal for connecting Shopify stores:
 * 1. Enter shop domain
 * 2. Validate domain
 * 3. Show permissions
 * 4. Connect (redirect to Shopify)
 * 5. Show progress
 * 6. Show success
 */
export function StoreConnectionModal({
  open,
  onClose,
  onSuccess,
}: StoreConnectionModalProps) {
  const [step, setStep] = useState<'input' | 'permissions' | 'connecting' | 'success'>('input');
  const [shopDomain, setShopDomain] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [connectedStore, setConnectedStore] = useState<{
    id: string;
    shopDomain: string;
    installedAt: Date;
  } | null>(null);

  const { initiateOAuth, isInitiating } = useOAuthFlow();

  const handleValidation = (result: ValidationResult) => {
    setValidation(result);
  };

  const handleContinue = () => {
    if (validation?.isValid) {
      setStep('permissions');
    }
  };

  const handleConnect = async () => {
    if (!validation?.isValid) return;

    setStep('connecting');
    
    try {
      const result = await initiateOAuth(validation.shopDomain);
      
      if (result.success) {
        // OAuth will redirect, so we show progress
        // Success will be handled by message listener
      } else {
        // Show error and go back to input
        setStep('input');
      }
    } catch (error) {
      console.error('OAuth initiation failed:', error);
      setStep('input');
    }
  };

  const handleClose = () => {
    setStep('input');
    setShopDomain('');
    setValidation(null);
    setConnectedStore(null);
    onClose();
  };

  const handleSuccessContinue = () => {
    if (connectedStore && onSuccess) {
      onSuccess(connectedStore.id);
    }
    handleClose();
  };

  // Listen for OAuth success message
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'OAUTH_SUCCESS') {
        setConnectedStore({
          id: event.data.storeId,
          shopDomain: event.data.shopDomain,
          installedAt: new Date(),
        });
        setStep('success');
      } else if (event.data.type === 'OAUTH_ERROR') {
        setStep('input');
      }
    };
    
    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'input' && 'Connect Your Shopify Store'}
            {step === 'permissions' && 'Review Permissions'}
            {step === 'connecting' && 'Connecting...'}
            {step === 'success' && 'Store Connected!'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {step === 'input' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your Shopify store domain to connect it to Smart Pricing.
              </p>
              
              <ShopDomainInput
                value={shopDomain}
                onChange={setShopDomain}
                onValidation={handleValidation}
                autoFocus
              />

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleContinue}
                  disabled={!validation?.isValid}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 'permissions' && validation && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Smart Pricing will request the following permissions:
              </p>
              
              <PermissionPreview
                shopDomain={validation.shopDomain}
                scopes={['read_products', 'write_products', 'read_orders']}
              />

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setStep('input')}>
                  Back
                </Button>
                <Button onClick={handleConnect} disabled={isInitiating}>
                  {isInitiating ? 'Connecting...' : 'Connect Store'}
                </Button>
              </div>
            </div>
          )}

          {step === 'connecting' && (
            <OAuthProgress
              step={2}
              totalSteps={5}
              status="authorizing"
              message="Waiting for authorization on Shopify..."
            />
          )}

          {step === 'success' && connectedStore && (
            <ConnectionSuccess
              store={connectedStore}
              onContinue={handleSuccessContinue}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
