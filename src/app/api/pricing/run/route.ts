// API endpoint to manually trigger pricing algorithm
import { NextResponse } from 'next/server';
import { runPricingAlgorithm } from '@/features/pricing-engine/services/pricingAlgorithm';

export async function POST() {
  try {
    const result = await runPricingAlgorithm();

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

