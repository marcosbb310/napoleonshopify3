const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  require('dotenv').config({ path: '.env' });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wmqrvvuxioukuwvvtmpe.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtcXJ2dnV4aW91a3V3dnZ0bXBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAzNjE3MCwiZXhwIjoyMDc1NjEyMTcwfQ.50KCeDS2H3rijmP7enigBqJlc5feMc3Sqicq8uMZfCg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyImages() {
  console.log('🔍 Verifying product images setup...\n');

  // Check if images column exists
  console.log('1️⃣ Checking if images column exists...');
  const { data: columnCheck, error: columnError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'images';
    `
  });

  if (columnError) {
    console.log('   ⚠️  Could not check column (this is okay if exec_sql has restrictions)');
  } else {
    console.log('   ✅ Images column check completed');
  }

  // Check products with images
  console.log('\n2️⃣ Checking products for images...');
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, title, shopify_id, images, is_active')
    .eq('is_active', true)
    .limit(10);

  if (productsError) {
    console.error('   ❌ Error fetching products:', productsError.message);
    return;
  }

  if (!products || products.length === 0) {
    console.log('   ⚠️  No active products found');
    return;
  }

  console.log(`   📦 Found ${products.length} active products\n`);

  // Analyze image data
  let productsWithImages = 0;
  let productsWithoutImages = 0;
  let totalImages = 0;

  products.forEach((product, index) => {
    const hasImages = product.images && Array.isArray(product.images) && product.images.length > 0;
    
    if (hasImages) {
      productsWithImages++;
      totalImages += product.images.length;
      console.log(`   ✅ Product ${index + 1}: "${product.title}"`);
      console.log(`      - Images: ${product.images.length}`);
      if (product.images[0]?.src) {
        console.log(`      - First image URL: ${product.images[0].src.substring(0, 60)}...`);
      }
    } else {
      productsWithoutImages++;
      console.log(`   ⚠️  Product ${index + 1}: "${product.title}"`);
      console.log(`      - No images (images: ${JSON.stringify(product.images)})`);
    }
    console.log('');
  });

  // Summary
  console.log('📊 Summary:');
  console.log(`   - Products with images: ${productsWithImages}/${products.length}`);
  console.log(`   - Products without images: ${productsWithoutImages}/${products.length}`);
  console.log(`   - Total images found: ${totalImages}`);

  if (productsWithImages === 0) {
    console.log('\n⚠️  No products have images yet. You need to sync products from Shopify.');
    console.log('   → Go to your app and click "Sync Products" to populate images.');
  } else {
    console.log('\n✅ Images are being stored correctly!');
    console.log('   → Check your product cards in the app to see if images display.');
  }
}

verifyImages()
  .then(() => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });

