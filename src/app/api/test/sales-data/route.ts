// API endpoint to create test sales data for revenue testing
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Get the first active store (for testing purposes)
    const { data: stores } = await supabase
      .from('stores')
      .select('id')
      .eq('is_active', true)
      .limit(1);
      
    if (!stores || stores.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active stores found' },
        { status: 404 }
      );
    }
    
    const store = stores[0];
    
    // Get test products
    const { data: products } = await supabase
      .from('products')
      .select('id, title')
      .eq('store_id', store.id)
      .like('title', '%Test Product%')
      .limit(1);
      
    if (!products || products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No test products found. Create a test product first.' },
        { status: 404 }
      );
    }
    
    const product = products[0];
    
    // Create test sales data for the last 2 days
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);
    
    const salesData = [
      {
        product_id: product.id,
        date: yesterday.toISOString().split('T')[0],
        revenue: 100.00,
        units_sold: 5,
        created_at: new Date().toISOString(),
      },
      {
        product_id: product.id,
        date: dayBefore.toISOString().split('T')[0],
        revenue: 120.00, // Higher revenue yesterday
        units_sold: 6,
        created_at: new Date().toISOString(),
      },
    ];
    
    const { error } = await supabase
      .from('sales_data')
      .upsert(salesData, { onConflict: 'product_id,date' });
      
    if (error) {
      return NextResponse.json(
        { success: false, error: `Failed to create sales data: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test sales data created successfully',
      product: {
        id: product.id,
        title: product.title,
      },
      salesData: salesData.map(s => ({
        date: s.date,
        revenue: s.revenue,
        units_sold: s.units_sold,
      })),
      instructions: {
        step1: 'Sales data shows revenue drop from $120 to $100',
        step2: 'Run pricing algorithm to test revenue-based decisions',
        step3: 'Should trigger revert due to revenue drop',
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}