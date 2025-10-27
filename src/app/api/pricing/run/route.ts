// API endpoint to manually trigger pricing algorithm
import { NextRequest, NextResponse } from 'next/server';
import { requireStore } from '@/shared/lib/apiAuth';
import { runPricingAlgorithm } from '@/features/pricing-engine/services/pricingAlgorithm';

export async function POST(request: NextRequest) {
  try {
    // NEW AUTH: Require authenticated store
    const { user, store, error } = await requireStore(request);
    if (error) return error;

    const result = await runPricingAlgorithm(store.id, store.shop_domain, store.access_token);

    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `Algorithm completed successfully` 
        : `Algorithm completed with ${result.errors.length} errors`,
      stats: result.stats,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        message: 'Algorithm execution failed',
        error: message,
      },
      { status: 500 }
    );
  }
}

