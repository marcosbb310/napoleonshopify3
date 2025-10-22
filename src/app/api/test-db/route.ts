import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase';

export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();
    
    // Test 1: Check if new tables exist
    const { data: usersTest, error: usersError } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);
    
    const { data: storesTest, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('count')
      .limit(1);

    // Test 2: Check if products table has store_id column
    const { data: productsTest, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, store_id')
      .limit(1);

    return NextResponse.json({
      success: true,
      tests: {
        usersTable: { exists: !usersError, error: usersError?.message },
        storesTable: { exists: !storesError, error: storesError?.message },
        productsStoreId: { exists: !productsError, hasStoreIdColumn: productsTest ? true : false, error: productsError?.message }
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
