// Test script to create a product and test first increase
import { createAdminClient } from '@/shared/lib/supabase';

async function createTestProduct() {
  const supabase = createAdminClient();
  
  // Create a test product
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      store_id: 'your-store-id', // Replace with actual store ID
      shopify_id: 'test-product-' + Date.now(),
      title: 'Test Product for First Increase',
      vendor: 'Test Vendor',
      product_type: 'Test Type',
      starting_price: 10.00,
      current_price: 10.00,
    })
    .select()
    .single();
    
  if (error) {
    console.error('Error creating test product:', error);
    return;
  }
  
  console.log('Test product created:', product);
  return product;
}

// Run this in browser console or create an API endpoint
createTestProduct();
