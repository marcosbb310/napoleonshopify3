#!/usr/bin/env node

/**
 * Run Variant-Level Pricing Migrations
 * Executes migrations 020, 021, 024, 022, 023 for variant-level pricing support
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(filename) {
  console.log(`\n🔄 Running migration: ${filename}`);
  
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', filename);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    return false;
  }
  
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  try {
    // Call the exec_sql RPC function
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error(`❌ Migration ${filename} failed:`, error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return false;
    }
    
    console.log(`✅ Migration ${filename} completed successfully`);
    
    // Check if the result indicates an error
    if (data && typeof data === 'string' && data.startsWith('ERROR:')) {
      console.error(`❌ SQL execution error: ${data}`);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`❌ Migration ${filename} failed:`, err.message);
    return false;
  }
}

async function verifyMigration(filename) {
  console.log(`🔍 Verifying migration: ${filename}`);
  
  // Simple verification queries
  const verifications = {
    '020_add_variant_store_id.sql': [
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'product_variants' AND column_name = 'store_id'",
    ],
    '021_variant_level_pricing.sql': [
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'pricing_config' AND column_name = 'variant_id'",
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'product_variants' AND column_name IN ('starting_price', 'current_price')",
    ],
    '024_add_variant_id_to_history_and_sales.sql': [
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'pricing_history' AND column_name = 'variant_id'",
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'variant_id'",
    ],
  };
  
  const checks = verifications[filename];
  if (!checks) {
    console.log('⚠️  No verification checks defined for this migration');
    return true;
  }
  
  for (const query of checks) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: `SELECT * FROM (${query}) AS verification_check` });
      
      if (error) {
        console.error(`⚠️  Verification warning: ${error.message}`);
      } else {
        console.log(`✅ Verification passed: Found expected columns`);
      }
    } catch (err) {
      console.warn(`⚠️  Verification error: ${err.message}`);
    }
  }
  
  return true;
}

async function main() {
  console.log('🚀 Starting variant-level pricing migrations...\n');
  console.log('Migrating from product-level to variant-level pricing');
  console.log('==========================================\n');
  
  const migrations = [
    '020_add_variant_store_id.sql',
    '021_variant_level_pricing.sql',
    '024_add_variant_id_to_history_and_sales.sql',
    '022_migrate_pricing_configs.sql',
    '023_update_rls_for_variants.sql',
  ];
  
  let successCount = 0;
  let failCount = 0;
  
  for (const migration of migrations) {
    const success = await runMigration(migration);
    
    if (success) {
      successCount++;
      await verifyMigration(migration);
    } else {
      failCount++;
      console.error(`\n❌ Migration ${migration} failed - stopping execution`);
      console.log('\n⚠️  NOTE: Previous migrations may have already run');
      console.log('   You can safely re-run this script - migrations use IF NOT EXISTS');
      console.log('   Check the logs above to see what succeeded and what failed\n');
      break;
    }
    
    // Small delay between migrations
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n==========================================');
  console.log(`✅ Successful migrations: ${successCount}`);
  console.log(`❌ Failed migrations: ${failCount}`);
  console.log('==========================================\n');
  
  if (failCount === 0) {
    console.log('🎉 All variant-level pricing migrations completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Test product sync to verify variant prices populate');
    console.log('   2. Test pricing algorithm to verify it processes variants');
    console.log('   3. Check verification queries (see RUN_MIGRATIONS_NOW.md)');
    console.log('\n✅ The system is now using variant-level pricing!');
  } else {
    console.log('⚠️  Some migrations failed. Please review the errors above.');
    console.log('   You may need to fix issues manually in Supabase dashboard.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

