// Dashboard page
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart';
import { Badge } from '@/shared/components/ui/badge';
import { DollarSign, TrendingUp, Package, AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
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
    baselineRevenue: 52847, // What revenue would have been without algorithm
    baselineProfit: 11924, // What profit would have been without algorithm
    pricesChangedToday: 12, // Number of prices changed today
    productsNeedingAttention: 3, // Products that need review
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
          Your smart pricing is actively optimizing {metrics.optimizedProducts} products
        </p>
      </div>

      {/* Trust Anchor - Hero Message */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">
                You&apos;ve made ${metrics.addedProfit.toLocaleString()} more this month
              </h2>
              <p className="text-muted-foreground mb-3">
                Compared to if your prices had stayed at their starting point, our algorithm has increased your profit by{' '}
                <span className="font-semibold text-green-600">+{metrics.addedProfitChange}%</span>.
                It&apos;s adjusted {metrics.pricesChangedToday} prices today to keep maximizing your revenue.
              </p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="font-medium">{metrics.optimizedProducts} products optimizing</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="font-medium">+{metrics.addedRevenueChange}% revenue increase</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
              Revenue Impact
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +${metrics.addedRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              <span className="text-green-600">+{metrics.addedRevenueChange}%</span> vs static baseline
            </p>
            <p className="text-xs text-muted-foreground/70">
              You&apos;d have ${metrics.baselineRevenue.toLocaleString()} without algorithm
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Profit Impact
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +${metrics.addedProfit.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              <span className="text-green-600">+{metrics.addedProfitChange}%</span> vs static baseline
            </p>
            <p className="text-xs text-muted-foreground/70">
              You&apos;d have ${metrics.baselineProfit.toLocaleString()} without algorithm
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Algorithm Status
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.optimizedProducts}
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              <span className="text-blue-600">{metrics.optimizationRate}%</span> of products optimizing
            </p>
            <p className="text-xs text-muted-foreground/70">
              {metrics.pricesChangedToday} prices adjusted today
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
            {/* Needs Attention Section - Critical for Trust */}
            {metrics.productsNeedingAttention > 0 && (
              <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <CardTitle className="text-base">Needs Your Attention</CardTitle>
                    <Badge variant="secondary" className="ml-auto">{metrics.productsNeedingAttention}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between py-2 border-b border-yellow-200/50 dark:border-yellow-900/50 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium flex items-center gap-2">
                          Basic Hoodie
                          <Badge variant="outline" className="text-xs">Manual Review Suggested</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Performance declining: -$45 profit vs last period
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Algorithm suggests price may be too high for current demand
                        </p>
                      </div>
                      <button 
                        onClick={() => router.push('/analytics?product=Basic%20Hoodie')}
                        className="text-xs text-primary hover:underline whitespace-nowrap ml-3"
                      >
                        Review →
                      </button>
                    </div>
                    <div className="flex items-start justify-between py-2 border-b border-yellow-200/50 dark:border-yellow-900/50 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium flex items-center gap-2">
                          Plain White Socks
                          <Badge variant="outline" className="text-xs">Low Volume</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Only 12 units sold this period despite price reductions
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Consider inventory adjustment or promotion
                        </p>
                      </div>
                      <button 
                        onClick={() => router.push('/analytics?product=Plain%20White%20Socks')}
                        className="text-xs text-primary hover:underline whitespace-nowrap ml-3"
                      >
                        Review →
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Top Performers</CardTitle>
                  <button 
                    onClick={() => router.push('/analytics?tab=rankings')}
                    className="text-xs text-primary hover:underline"
                  >
                    View All →
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Products where smart pricing is delivering the best results
                </p>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  {[
                    { name: 'Premium Denim Jeans', profit: 987, change: 28.3, status: 'Exploiting low elasticity' },
                    { name: 'Classic Cotton T-Shirt', profit: 847, change: 22.1, status: 'Optimal price found' },
                    { name: 'Summer Dress Collection', profit: 654, change: 18.7, status: 'Testing higher ceiling' }
                  ].map((product, i) => (
                    <div key={i} className="flex items-start justify-between py-2 border-b last:border-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-muted-foreground/40">#{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                              {product.status}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-sm font-bold text-green-600 flex items-center gap-1">
                          <ArrowUpRight className="h-3 w-3" />
                          +${product.profit}
                        </p>
                        <p className="text-xs text-green-600">+{product.change}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Algorithm Activity</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    What your smart pricing did recently
                  </p>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 pb-2 border-b last:border-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950">
                        <ArrowUpRight className="h-3 w-3 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">Increased price to maximize profit</p>
                        <p className="text-xs text-muted-foreground">
                          Classic T-Shirt: $29.99 → $32.99
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Low elasticity detected (-0.18)
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">2m ago</div>
                    </div>
                    <div className="flex items-start gap-3 pb-2 border-b last:border-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
                        <Activity className="h-3 w-3 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">Testing new price point</p>
                        <p className="text-xs text-muted-foreground">
                          Summer Dress: $62.99 → $64.99
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Exploring price ceiling (bandit test)
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">45m ago</div>
                    </div>
                    <div className="flex items-start gap-3 pb-2 border-b last:border-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950">
                        <ArrowDownRight className="h-3 w-3 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">Reduced to boost volume</p>
                        <p className="text-xs text-muted-foreground">
                          Winter Jacket: $89.99 → $84.99
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          High elasticity - trading margin for volume
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">2h ago</div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">Keeping optimal price</p>
                        <p className="text-xs text-muted-foreground">
                          Denim Jeans: Staying at $89.99
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Already at profit-maximizing price
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">4h ago</div>
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
