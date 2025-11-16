import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

/**
 * GET /api/system/health/products
 * 
 * Health check endpoint to monitor product data integrity.
 * Returns counts of products with NULL, empty, or invalid shopify_id values.
 * 
 * This endpoint helps detect data quality issues and ensures the fix is working.
 */
export async function GET(request: NextRequest) {
  // Health check endpoint for product data integrity
  try {
    const supabaseAdmin = createAdminClient();

    // Query for all invalid shopify_id cases
    const { data: allProducts, error } = await supabaseAdmin
      .from('products')
      .select('shopify_id, is_active');

    if (error) {
      console.error('❌ Health check query failed:', error);
      return NextResponse.json(
        { 
          ok: false,
          error: error.message 
        },
        { status: 500 }
      );
    }

    // Count different types of invalid IDs
    const nullIds = allProducts?.filter(p => p.shopify_id === null).length || 0;
    const emptyIds = allProducts?.filter(p => p.shopify_id === '').length || 0;
    const invalidStringIds = allProducts?.filter(p => 
      p.shopify_id === 'undefined' || p.shopify_id === 'null'
    ).length || 0;
    const activeNullIds = allProducts?.filter(p => 
      p.is_active === true && p.shopify_id === null
    ).length || 0;

    const allCountsAreZero = nullIds === 0 && emptyIds === 0 && invalidStringIds === 0;
    const ok = allCountsAreZero && activeNullIds === 0;

    // Log warnings for any non-zero values
    if (!ok) {
      console.warn('⚠️ Health check detected invalid shopify_id values:', {
        nullIds,
        emptyIds,
        invalidStringIds,
        activeNullIds,
      });
    } else {
      console.log('✅ Health check passed: All shopify_id values are valid');
    }

    return NextResponse.json({
      ok,
      nullIds,
      emptyIds,
      invalidStringIds,
      activeNullIds,
      totalProducts: allProducts?.length || 0,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Health check error:', error);
    return NextResponse.json(
      { 
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

