const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  require('dotenv').config({ path: '.env' });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wmqrvvuxioukuwvvtmpe.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtcXJ2dnV4aW91a3V3dnZ0bXBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAzNjE3MCwiZXhwIjoyMDc1NjEyMTcwfQ.50KCeDS2H3rijmP7enigBqJlc5feMc3Sqicq8uMZfCg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSyncFlow() {
  console.log('🔍 Testing Sync Flow - Verifying Images Are Saved\n');

  // Step 1: Get a store
  console.log('1️⃣ Getting stores...');
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('id, shop_domain, is_active')
    .eq('is_active', true)
    .limit(1);

  if (storesError || !stores || stores.length === 0) {
    console.error('   ❌ No active stores found:', storesError);
    return;
  }

  const store = stores[0];
  console.log(`   ✅ Found store: ${store.shop_domain} (${store.id})\n`);

  // Step 2: Check products before sync
  console.log('2️⃣ Checking products BEFORE sync...');
  const { data: productsBefore, error: beforeError } = await supabase
    .from('products')
    .select('id, title, shopify_id, images, updated_at')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .limit(5);

  if (beforeError) {
    console.error('   ❌ Error:', beforeError);
    return;
  }

  console.log(`   📦 Found ${productsBefore.length} products`);
  const productsWithImagesBefore = productsBefore.filter(p => 
    p.images && Array.isArray(p.images) && p.images.length > 0
  );
  console.log(`   📸 Products with images: ${productsWithImagesBefore.length}/${productsBefore.length}`);

  if (productsBefore.length > 0) {
    console.log(`   📝 Sample product: "${productsBefore[0].title}"`);
    console.log(`      - Images: ${JSON.stringify(productsBefore[0].images)}`);
    console.log(`      - Updated: ${productsBefore[0].updated_at}`);
  }
  console.log('');

  // Step 3: Check what ShopifyClient would return (simulate)
  console.log('3️⃣ Checking sync_status to see last sync...');
  const { data: syncStatus, error: syncError } = await supabase
    .from('sync_status')
    .select('*')
    .eq('store_id', store.id)
    .eq('sync_type', 'products')
    .order('started_at', { ascending: false })
    .limit(1);

  if (syncStatus && syncStatus.length > 0) {
    const lastSync = syncStatus[0];
    console.log(`   📅 Last sync: ${lastSync.started_at}`);
    console.log(`   ✅ Status: ${lastSync.status}`);
    console.log(`   📊 Synced: ${lastSync.products_synced}/${lastSync.total_products}`);
    console.log(`   ⏱️  Duration: ${lastSync.completed_at ? 'Completed' : 'In progress'}`);
  } else {
    console.log('   ⚠️  No sync status found');
  }
  console.log('');

  // Step 4: Check if images column accepts JSONB
  console.log('4️⃣ Verifying images column structure...');
  const { data: columnInfo, error: colError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'images';
    `
  });

  if (colError) {
    console.log('   ⚠️  Could not check column info (RPC may have restrictions)');
  } else {
    console.log('   ✅ Column exists');
  }

  // Step 5: Try to manually update one product with test image data
  console.log('\n5️⃣ Testing manual image update...');
  if (productsBefore.length > 0) {
    const testProduct = productsBefore[0];
    const testImages = [{
      id: 'test_123',
      productId: testProduct.shopify_id,
      src: 'https://cdn.shopify.com/test-image.jpg',
      alt: 'Test image',
      width: 800,
      height: 800
    }];

    console.log(`   🧪 Updating product "${testProduct.title}" with test image...`);
    const { data: updateResult, error: updateError } = await supabase
      .from('products')
      .update({ images: testImages })
      .eq('id', testProduct.id)
      .select('id, title, images');

    if (updateError) {
      console.error(`   ❌ Update failed:`, updateError);
      console.error(`   📋 Error details:`, JSON.stringify(updateError, null, 2));
    } else if (updateResult && updateResult.length > 0) {
      console.log(`   ✅ Update successful!`);
      console.log(`   📸 Updated images:`, JSON.stringify(updateResult[0].images, null, 2));
      
      // Verify it was saved
      const { data: verify, error: verifyError } = await supabase
        .from('products')
        .select('images')
        .eq('id', testProduct.id)
        .single();

      if (verifyError) {
        console.error(`   ❌ Verification failed:`, verifyError);
      } else {
        console.log(`   ✅ Verified saved images:`, JSON.stringify(verify.images, null, 2));
      }
    }
  }

  console.log('\n📋 Summary:');
  console.log('   - Store found:', store.shop_domain);
  console.log('   - Products checked:', productsBefore.length);
  console.log('   - Products with images:', productsWithImagesBefore.length);
  console.log('\n💡 Next steps:');
  console.log('   1. Check server logs during sync to see if images are being received from Shopify');
  console.log('   2. Verify syncProducts.ts is actually calling the upsert with images');
  console.log('   3. Check if there are any database constraints preventing image saves');
}

testSyncFlow()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

