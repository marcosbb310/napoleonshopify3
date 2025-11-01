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

    // Check if algorithm was skipped due to global toggle being disabled
    const isSkippedDueToGlobalToggle = result.errors.length > 0 
      && result.errors.some(err => err.includes('Global smart pricing is disabled'));

    // Determine appropriate message
    let message: string;
    if (isSkippedDueToGlobalToggle) {
      message = 'Global smart pricing is disabled. No products were processed.';
    } else if (result.stats.processed === 0 && result.errors.length === 0) {
      message = 'No products found with smart pricing enabled';
    } else if (result.success) {
      message = `Algorithm completed successfully`;
    } else {
      message = `Algorithm completed with ${result.errors.length} errors`;
    }

    return NextResponse.json({
      success: result.success,
      message,
      stats: result.stats,
      errors: result.errors.length > 0 ? result.errors : undefined,
      skipped: isSkippedDueToGlobalToggle,
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

