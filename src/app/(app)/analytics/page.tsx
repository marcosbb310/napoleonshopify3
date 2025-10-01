// Analytics page
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { Input } from '@/shared/components/ui/input';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  DollarSign, 
  Package,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  Edit3,
  Check,
  X,
  Search,
  Activity,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  // State for inline price editing
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});
  const [priceUpdateStatus, setPriceUpdateStatus] = useState<Record<string, 'saving' | 'success' | 'error'>>({});
  
  // State for ranking view options
  const ITEMS_PER_PAGE = 10; // Fixed items per page
  const [performersPage, setPerformersPage] = useState<number>(1);
  const [underperformersPage, setUnderperformersPage] = useState<number>(1);
  
  // State for product search
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // State for active tab
  const [activeTab, setActiveTab] = useState<string>('products');

  // Sample data for comprehensive analytics with previous period data
  const individualProducts = [
    {
      id: 'PROD-001',
      name: 'Classic Cotton T-Shirt',
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=150&h=150&fit=crop&crop=center',
      currentPrice: 29.99,
      basePrice: 24.99,
      avgPrice: 27.50,
      startingPrice: 24.99,
      totalSales: 1250,
      totalRevenue: 37487.50,
      totalProfit: 11246.25,
      profitMargin: 30.0,
      priceChanges: 8,
      conversionRate: 3.2,
      performanceScore: 8.5,
      tags: ['apparel', 'cotton', 'casual', 'bestseller'],
      vendor: 'Fashion Co',
      productType: 'T-Shirt',
      // Current Period (Last 30d)
      currentPeriod: {
        revenue: 3724,
        units: 127,
        avgPrice: 29.29,
        profitPerUnit: 9.81,
        profit: 1247,
        margin: 33.5
      },
      // Previous Period (Previous 30d)
      previousPeriod: {
        revenue: 3151,
        units: 134,
        avgPrice: 23.52,
        profitPerUnit: 7.61,
        profit: 1020,
        margin: 30.3
      },
      // vs Baseline (if price stayed at starting price)
      baseline: {
        revenue: 2987,
        profit: 1004
      },
      // Algorithm info
      algorithmStatus: 'success',
      algorithmStrategy: 'Exploiting low price elasticity (-0.28)',
      priceElasticity: -0.28,
      priceHistory: [
        { date: '2024-01-01', price: 24.99, sales: 145, revenue: 3623.55 },
        { date: '2024-02-01', price: 26.99, sales: 168, revenue: 4534.32 },
        { date: '2024-03-01', price: 26.99, sales: 172, revenue: 4642.28 },
        { date: '2024-04-01', price: 28.99, sales: 156, revenue: 4522.44 },
        { date: '2024-05-01', price: 29.99, sales: 189, revenue: 5668.11 },
        { date: '2024-06-01', price: 29.99, sales: 195, revenue: 5848.05 },
        { date: '2024-07-01', price: 27.99, sales: 225, revenue: 6297.75 },
      ]
    },
    {
      id: 'PROD-002',
      name: 'Premium Denim Jeans',
      image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=150&h=150&fit=crop&crop=center',
      currentPrice: 89.99,
      basePrice: 79.99,
      avgPrice: 85.00,
      startingPrice: 79.99,
      totalSales: 890,
      totalRevenue: 80091.10,
      totalProfit: 32036.44,
      profitMargin: 40.0,
      priceChanges: 12,
      conversionRate: 2.8,
      performanceScore: 9.2,
      tags: ['apparel', 'denim', 'premium', 'jeans'],
      vendor: 'Fashion Co',
      productType: 'Jeans',
      currentPeriod: {
        revenue: 13228,
        units: 147,
        avgPrice: 89.99,
        profitPerUnit: 36.05,
        profit: 5299,
        margin: 40.1
      },
      previousPeriod: {
        revenue: 11234,
        units: 158,
        avgPrice: 71.09,
        profitPerUnit: 28.04,
        profit: 4430,
        margin: 36.9
      },
      baseline: {
        revenue: 11758,
        profit: 4706
      },
      algorithmStatus: 'success',
      algorithmStrategy: 'Optimal price found - holding steady',
      priceElasticity: -0.42,
      priceHistory: [
        { date: '2024-01-01', price: 79.99, sales: 98, revenue: 7839.02 },
        { date: '2024-02-01', price: 84.99, sales: 112, revenue: 9518.88 },
        { date: '2024-03-01', price: 84.99, sales: 118, revenue: 10028.82 },
        { date: '2024-04-01', price: 87.99, sales: 125, revenue: 10998.75 },
        { date: '2024-05-01', price: 89.99, sales: 142, revenue: 12778.58 },
        { date: '2024-06-01', price: 89.99, sales: 148, revenue: 13318.52 },
        { date: '2024-07-01', price: 89.99, sales: 147, revenue: 13228.53 },
      ]
    },
    {
      id: 'PROD-003',
      name: 'Summer Dress Collection',
      image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=150&h=150&fit=crop&crop=center',
      currentPrice: 65.99,
      basePrice: 59.99,
      avgPrice: 62.00,
      startingPrice: 59.99,
      totalSales: 675,
      totalRevenue: 44543.25,
      totalProfit: 13362.98,
      profitMargin: 30.0,
      priceChanges: 6,
      conversionRate: 4.1,
      performanceScore: 7.8,
      tags: ['apparel', 'dress', 'summer', 'collection'],
      vendor: 'Summer Trends',
      productType: 'Dress',
      currentPeriod: {
        revenue: 6723,
        units: 102,
        avgPrice: 65.91,
        profitPerUnit: 19.78,
        profit: 2017,
        margin: 30.0
      },
      previousPeriod: {
        revenue: 7148,
        units: 120,
        avgPrice: 59.57,
        profitPerUnit: 17.87,
        profit: 2144,
        margin: 28.2
      },
      baseline: {
        revenue: 6119,
        profit: 1836
      },
      algorithmStatus: 'testing',
      algorithmStrategy: 'Testing price ceiling (bandit exploration)',
      priceElasticity: -1.12,
      priceHistory: [
        { date: '2024-01-01', price: 59.99, sales: 78, revenue: 4679.22 },
        { date: '2024-02-01', price: 59.99, sales: 85, revenue: 5099.15 },
        { date: '2024-03-01', price: 62.99, sales: 105, revenue: 6613.95 },
        { date: '2024-04-01', price: 64.99, sales: 125, revenue: 8123.75 },
        { date: '2024-05-01', price: 65.99, sales: 138, revenue: 9106.62 },
        { date: '2024-06-01', price: 65.99, sales: 142, revenue: 9370.58 },
        { date: '2024-07-01', price: 63.99, sales: 102, revenue: 6526.98 },
      ]
    }
  ];

  const performanceRankings = {
    topPerformers: [
      { name: 'Premium Denim Jeans', revenue: 80091.10, growth: 15.2 },
      { name: 'Classic Cotton T-Shirt', revenue: 37487.50, growth: 8.7 },
      { name: 'Summer Dress Collection', revenue: 44543.25, growth: 12.3 },
      { name: 'Leather Handbag', revenue: 52340.80, growth: 18.5 },
      { name: 'Wireless Headphones', revenue: 67890.45, growth: 22.1 },
      { name: 'Yoga Mat Premium', revenue: 28934.20, growth: 16.8 },
      { name: 'Organic Face Cream', revenue: 45678.90, growth: 19.3 },
      { name: 'Smart Watch Series', revenue: 91234.56, growth: 25.7 },
      { name: 'Coffee Bean Blend', revenue: 34567.89, growth: 14.2 },
      { name: 'Minimalist Backpack', revenue: 41234.56, growth: 17.9 },
      { name: 'Artisan Ceramic Mug', revenue: 23456.78, growth: 13.6 },
      { name: 'Essential Oil Set', revenue: 37890.12, growth: 20.4 }
    ],
    underperformers: [
      { name: 'Basic Hoodie', revenue: 12500.00, growth: -2.1 },
      { name: 'Casual Sneakers', revenue: 18900.00, growth: 1.5 },
      { name: 'Plain White Socks', revenue: 8900.00, growth: -5.3 },
      { name: 'Generic Phone Case', revenue: 15400.00, growth: -1.8 },
      { name: 'Basic Water Bottle', revenue: 11200.00, growth: -3.7 },
      { name: 'Simple Notebook', revenue: 9800.00, growth: -4.2 },
      { name: 'Plain Tote Bag', revenue: 13800.00, growth: 0.8 },
      { name: 'Basic Keychain', revenue: 6700.00, growth: -6.1 },
      { name: 'Generic Stickers', revenue: 4500.00, growth: -7.4 },
      { name: 'Plain Mouse Pad', revenue: 8200.00, growth: -2.9 },
      { name: 'Basic Desk Lamp', revenue: 19600.00, growth: -0.5 },
      { name: 'Simple Wall Clock', revenue: 13400.00, growth: -1.2 }
    ],
    opportunities: [
      { name: 'Winter Jacket', currentMargin: 22.0, potentialMargin: 35.0 },
      { name: 'Running Shorts', currentMargin: 18.0, potentialMargin: 28.0 },
      { name: 'Bluetooth Speaker', currentMargin: 25.0, potentialMargin: 38.0 },
      { name: 'Laptop Stand', currentMargin: 20.0, potentialMargin: 32.0 },
      { name: 'Fitness Tracker', currentMargin: 16.0, potentialMargin: 26.0 },
      { name: 'Travel Pillow', currentMargin: 24.0, potentialMargin: 36.0 }
    ]
  };

  const actionableInsights = [
    {
      type: 'price_adjustment',
      priority: 'high',
      product: 'Basic Hoodie',
      action: 'Increase price by $5 to improve margin',
      impact: 'Expected +15% profit increase'
    },
    {
      type: 'promotion',
      priority: 'medium',
      product: 'Winter Jacket',
      action: 'Create seasonal promotion',
      impact: 'Expected +25% sales boost'
    },
    {
      type: 'inventory',
      priority: 'low',
      product: 'Casual Sneakers',
      action: 'Reduce stock levels',
      impact: 'Free up capital for better performers'
    }
  ];

  // Handle URL parameters for deep linking
  useEffect(() => {
    const tab = searchParams.get('tab');
    const product = searchParams.get('product');
    
    if (tab) {
      setActiveTab(tab);
    }
    
    if (product) {
      setSearchQuery(decodeURIComponent(product));
    }
  }, [searchParams]);

  // Handle clicking on a product name in rankings
  const handleProductClick = (productName: string) => {
    setSearchQuery(productName);
    setActiveTab('products');
  };

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return individualProducts;
    }

    const query = searchQuery.toLowerCase();
    
    // Create array with relevance scores
    const scoredProducts = individualProducts
      .map(product => {
        const name = product.name.toLowerCase();
        const vendor = product.vendor.toLowerCase();
        const productType = product.productType.toLowerCase();
        const tags = product.tags.map(t => t.toLowerCase());
        
        let score = 0;
        
        // Name scoring (highest priority)
        if (name === query) {
          score += 1000;
        } else if (name.startsWith(query)) {
          score += 500;
        } else if (name.includes(` ${query} `) || name.includes(` ${query}`) || name.includes(`${query} `)) {
          score += 300;
        } else if (name.includes(query)) {
          score += 200;
        }
        
        // Tag scoring
        if (tags.some(tag => tag === query)) {
          score += 150;
        } else if (tags.some(tag => tag.startsWith(query))) {
          score += 100;
        } else if (tags.some(tag => tag.includes(query))) {
          score += 75;
        }
        
        // Product type scoring
        if (productType === query) {
          score += 120;
        } else if (productType.startsWith(query)) {
          score += 80;
        } else if (productType.includes(query)) {
          score += 50;
        }
        
        // Vendor scoring
        if (vendor === query) {
          score += 100;
        } else if (vendor.startsWith(query)) {
          score += 70;
        } else if (vendor.includes(query)) {
          score += 40;
        }
        
        return { product, score };
      })
      .filter(item => item.score > 0) // Only keep products with matches
      .sort((a, b) => b.score - a.score) // Sort by relevance score
      .map(item => item.product); // Extract products
    
    return scoredProducts;
  }, [searchQuery]);

  // Price editing helper functions
  const handleEditPrice = (productId: string, currentPrice: number) => {
    setEditingPrice(productId);
    setEditedPrices(prev => ({
      ...prev,
      [productId]: currentPrice.toString()
    }));
  };

  const handleSavePrice = async (productId: string) => {
    const newPrice = editedPrices[productId];
    if (newPrice && parseFloat(newPrice) > 0) {
      // Set saving status
      setPriceUpdateStatus(prev => ({ ...prev, [productId]: 'saving' }));
      
      try {
        // TODO: Implement actual price update via Shopify API
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set success status
        setPriceUpdateStatus(prev => ({ ...prev, [productId]: 'success' }));
        setEditingPrice(null);
        
        // Clear success status after 2 seconds
        setTimeout(() => {
          setPriceUpdateStatus(prev => {
            const updated = { ...prev };
            delete updated[productId];
            return updated;
          });
        }, 2000);
        
      } catch (error) {
        // Set error status
        setPriceUpdateStatus(prev => ({ ...prev, [productId]: 'error' }));
        
        // Clear error status after 3 seconds
        setTimeout(() => {
          setPriceUpdateStatus(prev => {
            const updated = { ...prev };
            delete updated[productId];
            return updated;
          });
        }, 3000);
      }
    }
  };

  const handleCancelEdit = (productId: string) => {
    setEditingPrice(null);
    setEditedPrices(prev => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
  };

  // Pagination helper functions
  const getPaginatedItems = (items: any[], count: number, page: number) => {
    const startIndex = (page - 1) * count;
    const endIndex = startIndex + count;
    return items.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems: number, itemsPerPage: number) => {
    return Math.ceil(totalItems / itemsPerPage);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Detailed insights and performance metrics
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="products">Product Analytics</TabsTrigger>
          <TabsTrigger value="history">Price History</TabsTrigger>
          <TabsTrigger value="rankings">Performance Rankings</TabsTrigger>
          <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <CardTitle>Individual Product Analytics</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Detailed performance metrics for each product
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-80">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, tag, vendor, or type..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {searchQuery && (
                      <Button
                        variant="outline"
                        onClick={() => setSearchQuery('')}
                        className="whitespace-nowrap"
                      >
                        View All
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No products found</h3>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search query
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {filteredProducts.map((product) => {
                      // Calculate comparisons
                      const profitDelta = product.currentPeriod.profit - product.previousPeriod.profit;
                      const profitDeltaPct = ((profitDelta / product.previousPeriod.profit) * 100).toFixed(1);
                      const vsBaseline = ((product.currentPeriod.profit - product.baseline.profit) / product.baseline.profit * 100).toFixed(1);
                      
                      const revenueDelta = product.currentPeriod.revenue - product.previousPeriod.revenue;
                      const revenuePct = ((revenueDelta / product.previousPeriod.revenue) * 100).toFixed(1);
                      
                      const unitsDelta = product.currentPeriod.units - product.previousPeriod.units;
                      const unitsPct = ((unitsDelta / product.previousPeriod.units) * 100).toFixed(1);
                      
                      const avgPriceDelta = product.currentPeriod.avgPrice - product.previousPeriod.avgPrice;
                      const avgPricePct = ((avgPriceDelta / product.previousPeriod.avgPrice) * 100).toFixed(1);
                      
                      const profitPerUnitDelta = product.currentPeriod.profitPerUnit - product.previousPeriod.profitPerUnit;
                      const profitPerUnitPct = ((profitPerUnitDelta / product.previousPeriod.profitPerUnit) * 100).toFixed(1);
                      
                      const marginDelta = product.currentPeriod.margin - product.previousPeriod.margin;
                      
                      // Get algorithm status
                      const getStatusBadge = () => {
                        if (product.algorithmStatus === 'success') {
                          return { icon: CheckCircle2, label: 'Auto Optimizing', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-950' };
                        } else if (product.algorithmStatus === 'testing') {
                          return { icon: Activity, label: 'Testing', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-950' };
                        } else {
                          return { icon: AlertTriangle, label: 'Needs Review', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-950' };
                        }
                      };
                      
                      const statusBadge = getStatusBadge();
                      
                      return (
                        <div key={product.id} className="border-2 rounded-lg p-6 hover:border-primary/40 transition-colors">
                          {/* TIER 1: Glance Test - Hero Metrics */}
                          <div className="mb-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <img 
                                  src={product.image} 
                                  alt={product.name}
                                  className="w-16 h-16 rounded-lg object-cover border"
                                />
                                <div>
                                  <h3 className="text-xl font-bold">{product.name}</h3>
                                  <p className="text-sm text-muted-foreground">{product.vendor} • {product.productType}</p>
                                </div>
                              </div>
                              <Badge className={`${statusBadge.bg} ${statusBadge.color} border-0`}>
                                <statusBadge.icon className="h-3.5 w-3.5 mr-1.5" />
                                {statusBadge.label}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                              <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-950/10 border-green-200 dark:border-green-900">
                                <CardContent className="p-4">
                                  <p className="text-xs text-muted-foreground mb-1">Profit Δ (Last 30d)</p>
                                  <p className="text-3xl font-bold text-green-600 mb-1">
                                    +${profitDelta.toLocaleString()}
                                  </p>
                                  <p className="text-xs text-green-600 font-medium">
                                    {parseFloat(profitDeltaPct) > 0 ? '+' : ''}{profitDeltaPct}% vs prev period
                                  </p>
                                </CardContent>
                              </Card>
                              
                              <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-950/10 border-blue-200 dark:border-blue-900">
                                <CardContent className="p-4">
                                  <p className="text-xs text-muted-foreground mb-1">vs Baseline</p>
                                  <p className="text-3xl font-bold text-blue-600 mb-1">
                                    +{vsBaseline}%
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    +${(product.currentPeriod.profit - product.baseline.profit).toFixed(0)} more
                                  </p>
                                </CardContent>
                              </Card>
                              
                              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                                <CardContent className="p-4">
                                  <p className="text-xs text-muted-foreground mb-1">Current Price</p>
                                  <p className="text-3xl font-bold text-primary mb-1">
                                    ${product.currentPrice}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    from ${product.startingPrice} start
                                  </p>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                          
                          {/* TIER 2: Understanding Layer - Detailed Breakdown */}
                          <div className="space-y-4 mb-4">
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Algorithm Activity:</h4>
                              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Price Journey:</span>{' '}
                                  <span className="font-medium">${product.startingPrice} → ${product.avgPrice} (avg) → ${product.currentPrice} (current)</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Changes:</span>{' '}
                                  <span className="font-medium">{product.priceChanges} adjustments this period</span>
                                  {' • '}
                                  <span className="text-muted-foreground">Strategy:</span>{' '}
                                  <span className="font-medium">{product.algorithmStrategy}</span>
                                </p>
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-semibold mb-3">Performance (Last 30d vs Previous 30d):</h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div className="bg-muted/30 rounded-lg p-3">
                                  <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                                  <p className="text-lg font-bold">${product.currentPeriod.revenue.toLocaleString()}</p>
                                  <p className={`text-xs font-medium flex items-center gap-1 ${parseFloat(revenuePct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {parseFloat(revenuePct) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {revenuePct}% ({revenueDelta > 0 ? '+' : ''}${revenueDelta})
                                  </p>
                                </div>
                                
                                <div className="bg-muted/30 rounded-lg p-3">
                                  <p className="text-xs text-muted-foreground mb-1">Units Sold</p>
                                  <p className="text-lg font-bold">{product.currentPeriod.units}</p>
                                  <p className={`text-xs font-medium flex items-center gap-1 ${parseFloat(unitsPct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {parseFloat(unitsPct) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {unitsPct}% ({unitsDelta > 0 ? '+' : ''}{unitsDelta})
                                  </p>
                                </div>
                                
                                <div className="bg-muted/30 rounded-lg p-3">
                                  <p className="text-xs text-muted-foreground mb-1">Avg Price</p>
                                  <p className="text-lg font-bold">${product.currentPeriod.avgPrice.toFixed(2)}</p>
                                  <p className={`text-xs font-medium flex items-center gap-1 ${parseFloat(avgPricePct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {parseFloat(avgPricePct) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {avgPricePct}% (+${avgPriceDelta.toFixed(2)})
                                  </p>
                                </div>
                                
                                <div className="bg-primary/5 rounded-lg p-3 border-2 border-primary/20">
                                  <p className="text-xs text-muted-foreground mb-1">Profit/Unit ⭐</p>
                                  <p className="text-lg font-bold text-primary">${product.currentPeriod.profitPerUnit.toFixed(2)}</p>
                                  <p className={`text-xs font-medium flex items-center gap-1 ${parseFloat(profitPerUnitPct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {parseFloat(profitPerUnitPct) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {profitPerUnitPct}% (+${profitPerUnitDelta.toFixed(2)})
                                  </p>
                                </div>
                                
                                <div className="bg-muted/30 rounded-lg p-3">
                                  <p className="text-xs text-muted-foreground mb-1">Margin</p>
                                  <p className="text-lg font-bold">{product.currentPeriod.margin.toFixed(1)}%</p>
                                  <p className={`text-xs font-medium ${marginDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {marginDelta >= 0 ? '+' : ''}{marginDelta.toFixed(1)}pp (was {product.previousPeriod.margin}%)
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* TIER 3: Action Layer - Insights */}
                          <div className="border-t pt-4">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Strong performance</span> - Algorithm found optimal price range and is maximizing profit per unit.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Price History & Impact Analysis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Track price changes and their impact on sales and revenue
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover border"
                          />
                          <div>
                            <h3 className="font-semibold">{product.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Current: ${product.currentPrice} | Avg: ${product.avgPrice} | {product.priceChanges} changes
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          Performance: {product.performanceScore}/10
                        </Badge>
                      </div>

                      {/* Price History Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b text-sm">
                              <th className="text-left py-2 px-3">Date</th>
                              <th className="text-right py-2 px-3">Price</th>
                              <th className="text-right py-2 px-3">Change</th>
                              <th className="text-right py-2 px-3">Sales</th>
                              <th className="text-right py-2 px-3">Revenue</th>
                              <th className="text-right py-2 px-3">Impact</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.priceHistory.map((entry, index) => {
                              const prevEntry = index > 0 ? product.priceHistory[index - 1] : null;
                              const priceChange = prevEntry ? ((entry.price - prevEntry.price) / prevEntry.price) * 100 : 0;
                              const salesChange = prevEntry ? ((entry.sales - prevEntry.sales) / prevEntry.sales) * 100 : 0;
                              
                              return (
                                <tr key={entry.date} className="border-b text-sm hover:bg-muted/50">
                                  <td className="py-2 px-3">{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                                  <td className="text-right py-2 px-3 font-medium">${entry.price.toFixed(2)}</td>
                                  <td className="text-right py-2 px-3">
                                    {prevEntry && priceChange !== 0 && (
                                      <span className={priceChange > 0 ? 'text-green-600' : 'text-red-600'}>
                                        {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
                                      </span>
                                    )}
                                  </td>
                                  <td className="text-right py-2 px-3">{entry.sales}</td>
                                  <td className="text-right py-2 px-3">${entry.revenue.toLocaleString()}</td>
                                  <td className="text-right py-2 px-3">
                                    {prevEntry && salesChange !== 0 && (
                                      <div className="flex items-center justify-end gap-1">
                                        {salesChange > 0 ? (
                                          <ArrowUp className="h-3 w-3 text-green-600" />
                                        ) : (
                                          <ArrowDown className="h-3 w-3 text-red-600" />
                                        )}
                                        <span className={salesChange > 0 ? 'text-green-600' : 'text-red-600'}>
                                          {Math.abs(salesChange).toFixed(1)}%
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Key Insights */}
                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Highest Price</p>
                          <p className="text-lg font-semibold">
                            ${Math.max(...product.priceHistory.map(h => h.price)).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Best Sales Month</p>
                          <p className="text-lg font-semibold">
                            {Math.max(...product.priceHistory.map(h => h.sales))} units
                          </p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Total Historical Revenue</p>
                          <p className="text-lg font-semibold">
                            ${product.priceHistory.reduce((sum, h) => sum + h.revenue, 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rankings" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="h-[1000px] flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 p-4">
                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {getPaginatedItems(performanceRankings.topPerformers, ITEMS_PER_PAGE, performersPage).map((product, index) => {
                      const actualIndex = (performersPage - 1) * ITEMS_PER_PAGE + index;
                      return (
                        <div key={product.name} className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => handleProductClick(product.name)}
                              className="font-medium text-sm truncate text-left hover:underline cursor-pointer"
                            >
                              {product.name}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              ${product.revenue.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <Badge variant="secondary" className="mb-1 text-xs">
                              #{actualIndex + 1}
                            </Badge>
                            <p className="text-sm text-green-600 font-semibold">
                              +{product.growth}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {getTotalPages(performanceRankings.topPerformers.length, ITEMS_PER_PAGE) > 1 && (
                    <div className="flex-shrink-0 flex items-center justify-between mt-4 pt-3 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setPerformersPage(prev => Math.max(1, prev - 1))}
                        disabled={performersPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {performersPage} of {getTotalPages(performanceRankings.topPerformers.length, ITEMS_PER_PAGE)}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setPerformersPage(prev => prev + 1)}
                        disabled={performersPage === getTotalPages(performanceRankings.topPerformers.length, ITEMS_PER_PAGE)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="h-[1000px] flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    Worst Performers
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 p-4">
                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {getPaginatedItems(performanceRankings.underperformers, ITEMS_PER_PAGE, underperformersPage).map((product, index) => {
                      const actualIndex = (underperformersPage - 1) * ITEMS_PER_PAGE + index;
                      return (
                        <div key={product.name} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => handleProductClick(product.name)}
                              className="font-medium text-sm truncate text-left hover:underline cursor-pointer"
                            >
                              {product.name}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              ${product.revenue.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <Badge variant="destructive" className="mb-1 text-xs">
                              #{actualIndex + 1}
                            </Badge>
                            <p className="text-sm text-red-600 font-semibold">
                              {product.growth}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {getTotalPages(performanceRankings.underperformers.length, ITEMS_PER_PAGE) > 1 && (
                    <div className="flex-shrink-0 flex items-center justify-between mt-4 pt-3 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setUnderperformersPage(prev => Math.max(1, prev - 1))}
                        disabled={underperformersPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {underperformersPage} of {getTotalPages(performanceRankings.underperformers.length, ITEMS_PER_PAGE)}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setUnderperformersPage(prev => prev + 1)}
                        disabled={underperformersPage === getTotalPages(performanceRankings.underperformers.length, ITEMS_PER_PAGE)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="h-[1000px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    Optimization Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[calc(100%-4rem)]">
                  <div className="space-y-3">
                    {performanceRankings.opportunities.map((product) => (
                      <div key={product.name} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-sm">{product.name}</p>
                          <Badge variant="outline" className="text-xs">
                            +{product.potentialMargin - product.currentMargin}% potential
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>Current Margin</span>
                            <span>{product.currentMargin}%</span>
                          </div>
                          <Progress value={product.currentMargin} className="h-1.5" />
                          <div className="flex justify-between text-xs">
                            <span>Potential Margin</span>
                            <span>{product.potentialMargin}%</span>
                          </div>
                          <Progress value={product.potentialMargin} className="h-1.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Sales Velocity Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {individualProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.totalSales} units sold
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            {product.conversionRate > 3.5 ? (
                              <ArrowUp className="h-4 w-4 text-green-600" />
                            ) : product.conversionRate < 2.5 ? (
                              <ArrowDown className="h-4 w-4 text-red-600" />
                            ) : (
                              <Minus className="h-4 w-4 text-yellow-600" />
                            )}
                            <span className="text-sm font-medium">
                              {product.conversionRate}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">conversion</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Price Elasticity Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {individualProducts.map((product) => {
                      const priceChange = ((product.currentPrice - product.avgPrice) / product.avgPrice) * 100;
                      return (
                        <div key={product.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Current: ${product.currentPrice}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              {priceChange > 0 ? (
                                <ArrowUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <ArrowDown className="h-4 w-4 text-red-600" />
                              )}
                              <span className="text-sm font-medium">
                                {Math.abs(priceChange).toFixed(1)}%
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              vs avg price
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actionable Insights Section */}
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Actionable Insights</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Recommendations to optimize your pricing strategy
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {actionableInsights.map((insight, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {insight.type === 'price_adjustment' && (
                            <DollarSign className="h-5 w-5 text-green-600" />
                          )}
                          {insight.type === 'promotion' && (
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                          )}
                          {insight.type === 'inventory' && (
                            <Package className="h-5 w-5 text-orange-600" />
                          )}
                          <div>
                            <h3 className="font-semibold">{insight.product}</h3>
                            <p className="text-sm text-muted-foreground">
                              {insight.action}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={insight.priority === 'high' ? 'destructive' : 
                                   insight.priority === 'medium' ? 'default' : 'secondary'}
                        >
                          {insight.priority}
                        </Badge>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Expected Impact:</span>
                          <span className="text-sm text-muted-foreground">
                            {insight.impact}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => {
                            // TODO: Implement actual price change logic
                            alert(`Applying recommendation for ${insight.product}: ${insight.action}`);
                          }}
                        >
                          Apply Recommendation
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            // TODO: Show detailed price history and editing modal
                            alert(`Showing price history for ${insight.product}`);
                          }}
                        >
                          View Price History
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
      </Tabs>
    </div>
  );
}
