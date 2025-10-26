// API endpoint to create a test product for pricing algorithm testing
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Get the first active store (for testing purposes)
    const { data: stores } = await supabase
      .from('stores')
      .select('id, shop_domain')
      .eq('is_active', true)
      .limit(1);
      
    if (!stores || stores.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active stores found' },
        { status: 404 }
      );
    }
    
    const store = stores[0];
    
    // Create a test product
    const testProduct = {
      store_id: store.id,
      shopify_id: `test-product-${Date.now()}`,
      title: `Test Product for First Increase - ${new Date().toLocaleString()}`,
      vendor: 'Test Vendor',
      product_type: 'Test Type',
      starting_price: 10.00,
      current_price: 10.00,
      updated_at: new Date().toISOString(),
    };

    const { data: product, error } = await supabase
      .from('products')
      .insert(testProduct)
      .select()
      .single();
      
    if (error) {
      return NextResponse.json(
        { success: false, error: `Failed to create test product: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test product created successfully',
      product: {
        id: product.id,
        title: product.title,
        starting_price: product.starting_price,
        current_price: product.current_price,
        shopify_id: product.shopify_id,
      },
      instructions: {
        step1: 'Go to /products page and enable smart pricing for this product',
        step2: 'Use /api/test/pricing endpoint to trigger the algorithm',
        step3: 'Check the logs for first increase behavior',
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