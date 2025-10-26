// API endpoint to manually trigger the pricing algorithm for testing
import { NextRequest, NextResponse } from 'next/server';
import { runPricingAlgorithm } from '@/features/pricing-engine/services/pricingAlgorithm';
import { createAdminClient } from '@/shared/lib/supabase';
import { getDecryptedTokens } from '@/features/shopify-oauth/services/tokenService';

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
    
    // Get store credentials
    const tokens = await getDecryptedTokens(store.id);
    
    if (!tokens) {
      return NextResponse.json(
        { success: false, error: 'No store tokens found' },
        { status: 404 }
      );
    }
    
    console.log('🧪 TESTING: Starting manual pricing algorithm run...');
    
    // Run the algorithm
    const result = await runPricingAlgorithm(
      store.id,
      store.shop_domain,
      tokens.accessToken
    );
    
    console.log('🧪 TESTING: Algorithm run completed:', result);
    
    return NextResponse.json({
      success: result.success,
      message: 'Pricing algorithm executed',
      stats: result.stats,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('🧪 TESTING: Algorithm error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}