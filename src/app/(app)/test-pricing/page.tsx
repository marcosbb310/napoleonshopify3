// Test dashboard for pricing algorithm testing
'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { toast } from 'sonner';

export default function TestPricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

  const makeRequest = async (endpoint: string, description: string) => {
    setLoading(description);
    try {
      const response = await fetch(endpoint, { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setResults(data);
        
        // Show detailed feedback
        if (data.stats && data.stats.processed > 0) {
          toast.success(data.message || `${description} completed successfully`, {
            description: `${data.stats.increased} prices increased, ${data.stats.reverted} reverted, ${data.stats.waiting} waiting`,
          });
          
          // If products were actually processed, trigger refresh
          if (description.includes('Algorithm') || description.includes('Test First Increase') || description.includes('Test Revenue')) {
            // Wait a moment for Shopify to update, then notify the products page
            setTimeout(() => {
              // Dispatch custom event to trigger refresh on products page
              window.dispatchEvent(new CustomEvent('pricing-algorithm-completed'));
            }, 2000); // Increased to 2 seconds to give Shopify time to process
          }
        } else {
          // No products processed - show warning
          toast.warning(data.message || 'No products were processed', {
            description: 'Check if global smart pricing is enabled and products have auto-pricing enabled',
          });
        }
      } else {
        toast.error(data.error || 'Something went wrong');
      }
    } catch (error) {
      toast.error(`Failed to ${description.toLowerCase()}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🧪 Pricing Algorithm Testing</h1>
        <p className="text-muted-foreground mt-2">
          Test the first increase logic and revenue-based decisions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Step 1: Create Test Product */}
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Create Test Product</CardTitle>
            <CardDescription>
              Creates a test product to test the first increase logic
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => makeRequest('/api/test/create-product', 'Create Test Product')}
              disabled={loading === 'Create Test Product'}
              className="w-full"
            >
              {loading === 'Create Test Product' ? 'Creating...' : 'Create Test Product'}
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Enable Smart Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Enable Smart Pricing</CardTitle>
            <CardDescription>
              Go to Products page and enable smart pricing for the test product
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.open('/products', '_blank')}
              variant="outline"
              className="w-full"
            >
              Open Products Page
            </Button>
          </CardContent>
        </Card>

        {/* Step 3: Test First Increase */}
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Test First Increase</CardTitle>
            <CardDescription>
              Run the pricing algorithm to test immediate first increase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => makeRequest('/api/test/pricing', 'Test First Increase')}
              disabled={loading === 'Test First Increase'}
              className="w-full"
            >
              {loading === 'Test First Increase' ? 'Testing...' : 'Run Algorithm'}
            </Button>
          </CardContent>
        </Card>

        {/* Step 4: Create Sales Data */}
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Create Sales Data</CardTitle>
            <CardDescription>
              Add test sales data to test revenue-based decisions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => makeRequest('/api/test/sales-data', 'Create Sales Data')}
              disabled={loading === 'Create Sales Data'}
              className="w-full"
            >
              {loading === 'Create Sales Data' ? 'Creating...' : 'Add Sales Data'}
            </Button>
          </CardContent>
        </Card>

        {/* Step 5: Test Revenue Decisions */}
        <Card>
          <CardHeader>
            <CardTitle>Step 5: Test Revenue Decisions</CardTitle>
            <CardDescription>
              Run algorithm again to test revenue-based pricing decisions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => makeRequest('/api/test/pricing', 'Test Revenue Decisions')}
              disabled={loading === 'Test Revenue Decisions'}
              className="w-full"
            >
              {loading === 'Test Revenue Decisions' ? 'Testing...' : 'Test Revenue Logic'}
            </Button>
          </CardContent>
        </Card>

        {/* Check Results */}
        <Card>
          <CardHeader>
            <CardTitle>Check Results</CardTitle>
            <CardDescription>
              View the latest algorithm run results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
              variant="outline"
              className="w-full"
            >
              Open Supabase Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results Display */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(results, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Testing Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold">Expected First Increase Behavior:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Product should increase price immediately (no revenue check)</li>
              <li>Console should show: "🚀 First increase for [Product] - no revenue check needed"</li>
              <li><code>is_first_increase</code> should be set to <code>false</code> after increase</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold">Expected Revenue-Based Behavior:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Console should show: "📊 Revenue data for product [ID]: currentRevenue: 100, previousRevenue: 120, changePercent: -16.7%"</li>
              <li>Should show: "📉 Revenue dropped -16.7% for [Product] - reverting"</li>
              <li>Price should revert to previous price</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
