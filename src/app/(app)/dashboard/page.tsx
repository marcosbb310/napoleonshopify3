// Dashboard page
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { DollarSign, TrendingUp, Package, Activity } from 'lucide-react';
import { DashboardSkeleton } from '@/shared/components';
import { useAuth } from '@/features/auth';

export default function DashboardPage() {
  const { isInitialized } = useAuth();
  
  // TODO: Replace with real data from Shopify API
  const isLoading = false; // This would come from your data fetching hook
  const metrics = {
    totalRevenue: 0,
    revenueChange: 0,
    totalProfit: 0,
    profitChange: 0,
    activeProducts: 0,
    productsChange: 0,
    priceChanges: 0,
    changesChange: 0,
  };

  // Show skeleton during data loading or auth rehydration
  if (isLoading || !isInitialized) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your store&apos;s performance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+{metrics.revenueChange}%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Profit
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.totalProfit.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+{metrics.profitChange}%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.activeProducts}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+{metrics.productsChange}</span> new this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Price Changes Today
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.priceChanges}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.changesChange}% from yesterday
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Price increased</p>
                  <p className="text-xs text-muted-foreground">
                    Classic T-Shirt • $29.99 → $32.99
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">2m ago</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10">
                  <Package className="h-4 w-4 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New product added</p>
                  <p className="text-xs text-muted-foreground">
                    Summer Dress Collection
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">1h ago</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                  <DollarSign className="h-4 w-4 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Profit target reached</p>
                  <p className="text-xs text-muted-foreground">
                    Monthly goal achieved
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">3h ago</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <button className="w-full rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors">
                <div className="font-medium">View All Products</div>
                <div className="text-xs text-muted-foreground">
                  Manage your product catalog
                </div>
              </button>
              <button className="w-full rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors">
                <div className="font-medium">Bulk Price Update</div>
                <div className="text-xs text-muted-foreground">
                  Update multiple products at once
                </div>
              </button>
              <button className="w-full rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors">
                <div className="font-medium">View Analytics</div>
                <div className="text-xs text-muted-foreground">
                  See detailed performance metrics
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
