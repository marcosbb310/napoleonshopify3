// Dashboard page
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart';
import { Badge } from '@/shared/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Package, AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { DashboardSkeleton, DateRangePicker } from '@/shared/components';
import { useAuth } from '@/features/auth';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useRouter } from 'next/navigation';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';

export default function DashboardPage() {
  const { isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  // Date range state - defaults to last 30 days
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -29),
    to: new Date(),
  });
  
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

  // Show skeleton during data loading or auth check
  if (isLoading || authLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Your smart pricing is actively optimizing {metrics.optimizedProducts} products
            </p>
          </div>
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>

        {/* Top Metrics Row */}
        <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950 dark:via-green-950 dark:to-teal-950">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              Profit This Month
            </CardTitle>
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-4xl font-bold text-emerald-700 dark:text-emerald-400">
              +${metrics.addedProfit.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-0">
                +{metrics.addedProfitChange}%
              </Badge>
              <span className="text-xs text-emerald-700/70 dark:text-emerald-300/70">more than baseline</span>
            </div>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 pt-2 leading-relaxed">
              Compared to if your prices had stayed at their starting point, our algorithm has increased your profit by{' '}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{metrics.addedProfitChange}%</span>.
              It&apos;s adjusted {metrics.pricesChangedToday} prices today to keep maximizing your revenue.
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950 dark:via-green-950 dark:to-teal-950">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              Revenue Impact
            </CardTitle>
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-4xl font-bold text-emerald-700 dark:text-emerald-400">
              +${metrics.addedRevenue.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-0">
                +{metrics.addedRevenueChange}%
              </Badge>
              <span className="text-xs text-emerald-700/70 dark:text-emerald-300/70">vs static baseline</span>
            </div>
            <p className="text-xs text-emerald-700/60 dark:text-emerald-300/60 pt-1">
              You&apos;d have ${metrics.baselineRevenue.toLocaleString()} without algorithm
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Without Smart Pricing
            </CardTitle>
            <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-2">
              <Package className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-4xl font-bold text-slate-700 dark:text-slate-300">
              ${metrics.baselineProfit.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Your profit without our algorithm
            </p>
            <div className="flex items-center gap-1.5 pt-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                You&apos;re making ${metrics.addedProfit.toLocaleString()} more (+{metrics.addedProfitChange}%)
              </span>
            </div>
          </CardContent>
        </Card>
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

      {/* Analytics Overview Section */}
      <div className="space-y-3">
        <Tabs defaultValue="overview" className="space-y-3">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pricing">Pricing History</TabsTrigger>
            <TabsTrigger value="products">Product Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            {/* Product Performance Grid */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">Product Performance Overview</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Smart pricing impact vs baseline for all products
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-muted-foreground mb-0.5">Date Range</div>
                    <div className="text-sm font-semibold">
                      {dateRange?.from && dateRange?.to ? (
                        <>
                          {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
                        </>
                      ) : dateRange?.from ? (
                        format(dateRange.from, 'MMM d, yyyy')
                      ) : (
                        'No date selected'
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {[
                    { name: 'Premium Denim Jeans', withSmartPricing: 4850, withoutSmartPricing: 3863, image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=200&h=200&fit=crop' },
                    { name: 'Classic Cotton T-Shirt', withSmartPricing: 3920, withoutSmartPricing: 3073, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200&h=200&fit=crop' },
                    { name: 'Summer Dress Collection', withSmartPricing: 3180, withoutSmartPricing: 2526, image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=200&h=200&fit=crop' },
                    { name: 'Basic Hoodie', withSmartPricing: 2640, withoutSmartPricing: 2290, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=200&h=200&fit=crop' },
                    { name: 'Winter Jacket', withSmartPricing: 5420, withoutSmartPricing: 4880, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=200&h=200&fit=crop' },
                    { name: 'Plain White Socks', withSmartPricing: 890, withoutSmartPricing: 845, image: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=200&h=200&fit=crop' },
                    { name: 'Sport Shoes', withSmartPricing: 6750, withoutSmartPricing: 5920, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop' },
                    { name: 'Casual Shorts', withSmartPricing: 1820, withoutSmartPricing: 1620, image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=200&h=200&fit=crop' },
                    { name: 'Knit Sweater', withSmartPricing: 3150, withoutSmartPricing: 2890, image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=200&h=200&fit=crop' },
                    { name: 'Leather Belt', withSmartPricing: 1240, withoutSmartPricing: 1050, image: 'https://images.unsplash.com/photo-1624222247344-550fb60583bd?w=200&h=200&fit=crop' },
                  ].map((product, i) => {
                    const difference = product.withSmartPricing - product.withoutSmartPricing;
                    const percentChange = ((difference / product.withoutSmartPricing) * 100).toFixed(1);
                    const isPositive = difference > 0;
                    
                    return (
                      <div 
                        key={i} 
                        className="rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow aspect-square flex flex-col"
                      >
                        <div className="relative w-full h-32 bg-muted">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-3 flex-1 flex flex-col">
                          <p className="text-sm font-medium leading-tight mb-2 line-clamp-2">{product.name}</p>
                          <div className="mt-auto">
                            <div className="flex gap-1.5">
                              <div className="flex-1 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg p-2 border border-green-200 dark:border-green-800">
                                <div className="text-xs text-muted-foreground mb-0.5">Smart Pricing</div>
                                <div className="flex items-center gap-1">
                                  <div className="text-sm font-bold tracking-tight text-green-600">
                                    ${product.withSmartPricing.toLocaleString()}
                                  </div>
                                  <div className={`flex items-center gap-0.5 text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {isPositive ? (
                                      <TrendingUp className="h-3 w-3" />
                                    ) : (
                                      <TrendingDown className="h-3 w-3" />
                                    )}
                                    <span>{isPositive ? '+' : ''}{percentChange}%</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex-1 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                                <div className="text-xs text-muted-foreground mb-0.5">Without</div>
                                <div className="text-sm font-bold tracking-tight text-muted-foreground">
                                  ${product.withoutSmartPricing.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

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
