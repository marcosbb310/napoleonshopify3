'use client'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  ExternalLink,
  Store,
  Package,
  Clock,
  Activity,
  Plug
} from 'lucide-react'
import { useStores, Store as StoreType } from '../hooks/useStores'
import { toast } from 'sonner'

interface StoreConnectionCardProps {
  store: StoreType
  onDisconnect?: (storeId: string) => void
}

export function StoreConnectionCard({ store, onDisconnect }: StoreConnectionCardProps) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [connectionDetails, setConnectionDetails] = useState<{
    status: string;
    shop_info?: { shop?: { name?: string } };
    product_count?: number;
    error_message?: string;
  } | null>(null)
  const { testConnection, disconnectStore } = useStores()

  const handleVerifyConnection = async () => {
    setIsVerifying(true)
    try {
      const response = await fetch(`/api/shopify/verify-connection?storeId=${store.id}`)
      const result = await response.json()
      
      if (result.success) {
        setConnectionDetails(result.data.connection)
        toast.success('Connection verified successfully!')
      } else {
        toast.error(`Verification failed: ${result.error}`)
      }
    } catch (error) {
      toast.error('Failed to verify connection')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDisconnect = async () => {
    if (confirm(`Are you sure you want to disconnect ${store.shop_domain}?`)) {
      try {
        await disconnectStore.mutateAsync(store.id)
        onDisconnect?.(store.id)
      } catch (error) {
        // Error is handled by the mutation
      }
    }
  }

  const handleReconnect = async () => {
    // Disconnect first, then reinitiate OAuth with the same store
    try {
      await disconnectStore.mutateAsync(store.id)
      toast.success('Disconnected. Reconnecting with new permissions...')
      
      // Small delay to ensure disconnect is complete
      setTimeout(async () => {
        // Initiate OAuth for the same store domain
        const shopDomain = store.shop_domain
        if (!shopDomain) {
          toast.error('Shop domain not found')
          return
        }

        try {
          // Call the OAuth initiate endpoint
          const response = await fetch('/api/auth/shopify/v2/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shopDomain }),
          })

          const data = await response.json()

          if (!data.success || !data.oauthUrl) {
            toast.error(data.error || 'Failed to initiate OAuth')
            return
          }

          // Open OAuth URL in popup
          const width = 600
          const height = 700
          const left = window.screen.width / 2 - width / 2
          const top = window.screen.height / 2 - height / 2
          
          const popup = window.open(
            data.oauthUrl,
            'shopify-reconnect',
            `width=${width},height=${height},left=${left},top=${top}`
          )
          
          if (!popup) {
            toast.error('Please allow popups for this site')
            return
          }

          // Listen for success/failure
          const messageHandler = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return
            
            if (event.data.type === 'OAUTH_SUCCESS') {
              popup.close()
              window.removeEventListener('message', messageHandler)
              toast.success('Successfully reconnected with new permissions!')
              window.location.reload()
            } else if (event.data.type === 'OAUTH_ERROR') {
              popup.close()
              window.removeEventListener('message', messageHandler)
              toast.error(`Reconnection failed: ${event.data.error || 'OAuth failed'}`)
            }
          }
          
          window.addEventListener('message', messageHandler)
        } catch (error) {
          toast.error(`Failed to reconnect: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }, 1000)
    } catch (error) {
      toast.error('Failed to reconnect store')
    }
  }

  const getStatusIcon = () => {
    if (connectionDetails) {
      switch (connectionDetails.status) {
        case 'connected':
          return <CheckCircle2 className="h-4 w-4 text-green-600" />
        case 'error':
          return <XCircle className="h-4 w-4 text-red-600" />
        default:
          return <AlertCircle className="h-4 w-4 text-yellow-600" />
      }
    }
    return <CheckCircle2 className="h-4 w-4 text-green-600" />
  }

  const getStatusText = () => {
    if (connectionDetails) {
      switch (connectionDetails.status) {
        case 'connected':
          return 'Connected'
        case 'error':
          return 'Connection Error'
        default:
          return 'Unknown'
      }
    }
    return 'Connected'
  }

  const getStatusColor = () => {
    if (connectionDetails) {
      switch (connectionDetails.status) {
        case 'connected':
          return 'text-green-600'
        case 'error':
          return 'text-red-600'
        default:
          return 'text-yellow-600'
      }
    }
    return 'text-green-600'
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card className="border rounded-lg">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">{store.shop_domain}</h3>
              <div className="flex items-center gap-1 text-sm">
                {getStatusIcon()}
                <span className={getStatusColor()}>{getStatusText()}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Connected {formatDate(store.installed_at)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="default" 
              size="sm"
              onClick={handleReconnect}
              disabled={disconnectStore.isPending || isVerifying}
            >
              <Plug className="h-4 w-4 mr-1" />
              Reconnect
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleVerifyConnection}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Verify
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnectStore.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </div>

        {/* Connection Details */}
        {connectionDetails && (
          <div className="border-t pt-4 space-y-3">
            {connectionDetails.shop_info && (
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Shop:</span>
                <span className="font-medium">{connectionDetails.shop_info.shop?.name || 'Unknown'}</span>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Products</p>
                  <p className="font-medium">{connectionDetails.product_count || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Last Sync</p>
                  <p className="font-medium">{formatDate(store.last_synced_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge 
                    variant={connectionDetails.status === 'connected' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {connectionDetails.status === 'connected' ? 'Active' : 'Error'}
                  </Badge>
                </div>
              </div>
            </div>

            {connectionDetails.error_message && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Connection Error</span>
                </div>
                <p className="text-sm text-red-700 mt-1">{connectionDetails.error_message}</p>
              </div>
            )}
          </div>
        )}

        {/* Scope Information */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Permissions:</span>
            {store.scope && store.scope.trim() !== '' ? (
              <Badge variant="outline" className="text-xs">
                {store.scope}
              </Badge>
            ) : (
              <>
                <Badge variant="destructive" className="text-xs">
                  No Permissions
                </Badge>
                <span className="text-xs text-muted-foreground">
                  (Reconnect to grant permissions)
                </span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
