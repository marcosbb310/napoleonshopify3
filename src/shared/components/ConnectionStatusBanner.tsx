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
    <div className={cn(
      "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10",
      "border rounded-lg p-4 mx-4 mt-4"
    )}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
            Shopify Connection Issue
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            {storeName 
              ? `Unable to connect to ${storeName}. Please check your store connection.`
              : 'Unable to connect to your Shopify store. Please reconnect to continue using smart pricing.'
            }
          </p>
          {onReconnect && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onReconnect}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Reconnect Store
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
