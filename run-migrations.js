const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(filename) {
  console.log(`🔄 Running migration: ${filename}`);
  
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', filename);
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error(`❌ Migration ${filename} failed:`, error);
      return false;
    }
    
    console.log(`✅ Migration ${filename} completed successfully`);
    return true;
  } catch (err) {
    console.error(`❌ Migration ${filename} failed:`, err.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database migrations...');
  
  const migrations = [
    '013_create_oauth_sessions.sql',
    '014_create_shop_validation_cache.sql'
  ];
  
  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (!success) {
      console.error('❌ Migration failed, stopping...');
      process.exit(1);
    }
  }
  
  console.log('🎉 All migrations completed successfully!');
}

main().catch(console.error);
