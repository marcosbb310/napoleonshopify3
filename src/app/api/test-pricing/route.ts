// Manual trigger for testing - add this to your API
import { NextRequest, NextResponse } from 'next/server';
import { runPricingAlgorithm } from '@/features/pricing-engine/services/pricingAlgorithm';
import { createAdminClient } from '@/shared/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Get your store info
    const { data: store } = await supabase
      .from('stores')
      .select('id, shop_domain')
      .eq('is_active', true)
      .single();
      
    if (!store) {
      return NextResponse.json({ error: 'No active store found' }, { status: 404 });
    }
    
    // Get store credentials
    const { getDecryptedTokens } = await import('@/features/shopify-oauth/services/tokenService');
    const tokens = await getDecryptedTokens(store.id);
    
    if (!tokens) {
      return NextResponse.json({ error: 'No store tokens found' }, { status: 404 });
    }
    
    // Run the algorithm
    const result = await runPricingAlgorithm(
      store.id,
      store.shop_domain,
      tokens.accessToken
    );
    
    // Log detailed results for debugging
    console.log('📊 Algorithm Results:', {
      success: result.success,
      stats: result.stats,
      errors: result.errors,
      message: result.stats.processed > 0 
        ? `${result.stats.processed} products processed, ${result.stats.increased} increased, ${result.stats.reverted} reverted, ${result.stats.waiting} waiting`
        : 'No products processed - check if global smart pricing is enabled and products have auto_pricing_enabled=true'
    });
    
    // Return result with success flag and stats
    return NextResponse.json({ 
      success: result.success,
      stats: result.stats,
      errors: result.errors,
      message: result.stats.processed > 0 
        ? `Algorithm completed: ${result.stats.processed} products processed, ${result.stats.increased} increased, ${result.stats.reverted} reverted, ${result.stats.waiting} waiting`
        : '⚠️ No products were processed. Please enable global smart pricing and ensure products have auto_pricing_enabled set to true.'
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
