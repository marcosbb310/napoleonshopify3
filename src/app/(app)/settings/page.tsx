// Settings page
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { useAuth } from '@/features/auth';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [storeUrl, setStoreUrl] = useState(user?.shopifyStoreUrl || '');
  const [accessToken, setAccessToken] = useState('');

  const handleSaveShopify = () => {
    updateUser({ shopifyStoreUrl: storeUrl });
    // TODO: Initialize Shopify client with credentials
    console.log('Saving Shopify credentials:', { storeUrl, accessToken });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and integration settings
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Shopify Integration</CardTitle>
            <CardDescription>
              Connect your Shopify store to enable smart pricing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeUrl">Store URL</Label>
              <Input
                id="storeUrl"
                placeholder="your-store.myshopify.com"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your Shopify store URL (e.g., mystore.myshopify.com)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessToken">Admin API Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                placeholder="shpat_••••••••••••••••"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your Shopify Admin API access token
              </p>
            </div>

            <Button onClick={handleSaveShopify}>
              Save Shopify Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>
              Manage your account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={user?.name || ''}
                onChange={(e) => updateUser({ name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Global Pricing Settings</CardTitle>
            <CardDescription>
              Set default pricing parameters for new products
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaultMaxIncrease">Default Max Price Increase (%)</Label>
                <Input
                  id="defaultMaxIncrease"
                  type="number"
                  placeholder="20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultMaxDecrease">Default Max Price Decrease (%)</Label>
                <Input
                  id="defaultMaxDecrease"
                  type="number"
                  placeholder="15"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="updateFrequency">Price Update Frequency</Label>
              <select
                id="updateFrequency"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="realtime">Real-time</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            <Button>Save Pricing Settings</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
