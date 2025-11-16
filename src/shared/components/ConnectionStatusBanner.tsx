import { Button } from '@/shared/components/ui/button';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface ConnectionStatusBannerProps {
  isConnected: boolean;
  isLoading: boolean;
  storeName?: string;
  onReconnect?: () => void;
}

export function ConnectionStatusBanner({ 
  isConnected, 
  isLoading, 
  storeName,
  onReconnect 
}: ConnectionStatusBannerProps) {
  if (isLoading || isConnected) {
    return null;
  }

  return (
    <div
      className={cn(
        'border rounded-lg p-4 mx-4 mt-4 shadow-[0_12px_28px_-24px_rgba(2,5,9,0.8)]',
      )}
      style={{
        background:
          'linear-gradient(150deg, rgba(44, 34, 16, 0.45), rgba(21, 37, 58, 0.85))',
        borderColor: 'rgba(240, 237, 224, 0.3)',
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="felt-icon h-4 w-4 text-[rgba(255,209,125,0.9)] flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-[rgb(243,241,234)]">
          <h3 className="text-sm font-semibold mb-1 drop-shadow-[0_1px_0_rgba(2,5,9,0.55)]">
            Shopify Connection Issue
          </h3>
          <p className="text-sm text-[rgba(243,241,234,0.78)]">
            {storeName
              ? `Unable to connect to ${storeName}. Please check your store connection.`
              : 'Unable to connect to your Shopify store. Please reconnect to continue using smart pricing.'}
          </p>
          {onReconnect && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onReconnect}
            >
              <ExternalLink className="felt-icon h-3 w-3 mr-1" />
              Reconnect Store
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
