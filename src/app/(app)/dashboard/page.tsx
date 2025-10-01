// Dashboard page
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart';
import { DollarSign, TrendingUp, Package } from 'lucide-react';
import { DashboardSkeleton } from '@/shared/components';
import { useAuth } from '@/features/auth';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { isInitialized } = useAuth();
  const router = useRouter();
  
  // TODO: Replace with real data from Shopify API
  const isLoading = false; // This would come from your data fetching hook
  const metrics = {
    addedRevenue: 12450, // Revenue gained from smart pricing
    addedRevenueChange: 23.5, // % increase from smart pricing
    addedProfit: 3720, // Profit gained from smart pricing
    addedProfitChange: 31.2, // % increase in profit margin
    optimizedProducts: 47, // Products with optimized pricing
    optimizationRate: 78, // % of products optimized
  };

  // Chart data for revenue and profit trends
  const chartData = [
    { month: 'Jan', revenue: 12000, profit: 3600 },
    { month: 'Feb', revenue: 13500, profit: 4050 },
    { month: 'Mar', revenue: 14800, profit: 4440 },
    { month: 'Apr', revenue: 16200, profit: 4860 },
    { month: 'May', revenue: 17500, profit: 5250 },
    { month: 'Jun', revenue: 18900, profit: 5670 },
  ];

  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-1))",
    },
    profit: {
      label: "Profit",
      color: "hsl(var(--chart-2))",
    },
  };

  // Show skeleton during data loading or auth rehydration
  if (isLoading || !isInitialized) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your store&apos;s performance
        </p>
      </div>

      {/* Revenue & Profit Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue & Profit Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full aspect-auto">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-revenue)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-revenue)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-profit)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-profit)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={2}
                fill="url(#fillRevenue)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="var(--color-profit)"
                strokeWidth={2}
                fill="url(#fillProfit)"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Added Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +${metrics.addedRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+{metrics.addedRevenueChange}%</span> from smart pricing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Added Profit
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +${metrics.addedProfit.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+{metrics.addedProfitChange}%</span> profit increase
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Optimized Products
            </CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.optimizedProducts}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-blue-600">{metrics.optimizationRate}%</span> of total products
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Analytics Overview Section */}
      <div className="space-y-3">
        <Tabs defaultValue="overview" className="space-y-3">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pricing">Pricing History</TabsTrigger>
            <TabsTrigger value="products">Product Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Performing Products</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-sm font-medium">Product {i}</p>
                        <p className="text-xs text-muted-foreground">
                          Revenue: ${(1000 * i).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">${(50 * i).toFixed(2)}</p>
                        <p className="text-xs text-green-600">+{10 + i}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <TrendingUp className="h-3 w-3 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium">Price increased</p>
                        <p className="text-xs text-muted-foreground">
                          Classic T-Shirt • $29.99 → $32.99
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">2m ago</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/10">
                        <Package className="h-3 w-3 text-secondary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium">New product added</p>
                        <p className="text-xs text-muted-foreground">
                          Summer Dress Collection
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">1h ago</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
                        <DollarSign className="h-3 w-3 text-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium">Profit target reached</p>
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
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-1">
                    <button 
                      onClick={() => router.push('/products')}
                      className="w-full rounded-lg border p-2 text-left hover:bg-accent/50 transition-colors"
                    >
                      <div className="text-sm font-medium">View All Products</div>
                      <div className="text-xs text-muted-foreground">
                        Manage your product catalog
                      </div>
                    </button>
                    <button 
                      onClick={() => router.push('/products?bulkEdit=true')}
                      className="w-full rounded-lg border p-2 text-left hover:bg-accent/50 transition-colors"
                    >
                      <div className="text-sm font-medium">Bulk Price Update</div>
                      <div className="text-xs text-muted-foreground">
                        Update multiple products at once
                      </div>
                    </button>
                    <button 
                      onClick={() => router.push('/analytics')}
                      className="w-full rounded-lg border p-2 text-left hover:bg-accent/50 transition-colors"
                    >
                      <div className="text-sm font-medium">View Analytics</div>
                      <div className="text-xs text-muted-foreground">
                        See detailed performance metrics
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pricing History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  Pricing history chart will be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Product Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  Product performance data will be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
