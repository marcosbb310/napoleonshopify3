// Quick script to check if the pricing algorithm actually updated prices
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLatestRun() {
  // Get the last algorithm run
  const { data: lastRun } = await supabase
    .from('algorithm_runs')
    .select('*')
    .order('run_date', { ascending: false })
    .limit(1)
    .single();
  
  console.log('📊 Last Algorithm Run:');
  console.log(`  Date: ${lastRun?.run_date}`);
  console.log(`  Processed: ${lastRun?.products_processed}`);
  console.log(`  Increased: ${lastRun?.products_increased}`);
  console.log(`  Reverted: ${lastRun?.products_reverted}`);
  
  // Get recent price changes
  const { data: recentChanges } = await supabase
    .from('pricing_history')
    .select('*, products(title)')
    .order('change_date', { ascending: false })
    .limit(6);
  
  console.log('\n💰 Recent Price Changes:');
  recentChanges?.forEach(change => {
    console.log(`  ${change.products.title}:`);
    console.log(`    ${change.old_price} → ${change.new_price} (${change.reason})`);
  });
  
  process.exit(0);
}

checkLatestRun().catch(console.error);

