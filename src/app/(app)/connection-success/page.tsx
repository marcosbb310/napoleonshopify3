'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { CheckCircle2, Store, ArrowRight, Settings } from 'lucide-react'
import { useStores } from '@/features/shopify-integration'

export default function ConnectionSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { stores, isLoading } = useStores()
  const [countdown, setCountdown] = useState(5)

  const shopDomain = searchParams.get('shop')
  const connectedStore = stores.find(store => store.shop_domain === shopDomain)

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      router.push('/settings?tab=integrations')
    }
  }, [countdown, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Store Connected!</CardTitle>
          <CardDescription>
            Your Shopify store has been successfully connected to Smart Pricing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {connectedStore && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{connectedStore.shop_domain}</p>
                  <p className="text-sm text-muted-foreground">
                    Connected {new Date(connectedStore.installed_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold">What&apos;s next?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Verify your connection is working
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Set up your pricing strategies
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Start optimizing your prices
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={() => router.push('/settings?tab=integrations')}
              className="flex-1"
            >
              <Settings className="mr-2 h-4 w-4" />
              Manage Stores
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="flex-1"
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Redirecting to settings in {countdown} seconds...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
