# 🚀 Variant-Level Pricing Migrations - Instructions

## Current Status

✅ **Phase 1 & 3 Code**: All code updates are complete and working
⏳ **Database Migrations**: Need to be run manually

## Why Manual?

The automated migration script requires the `exec_sql` RPC function to exist, but we need to run migrations to create it - a chicken-and-egg problem. Manual execution is needed first.

## Step-by-Step Instructions

### Step 1: Open Supabase Dashboard

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Click on **"SQL Editor"** in the left sidebar

### Step 2: Run Combined Migration

1. Open the file: `supabase/migrations/VARIANT_MIGRATION_COMBINED.sql`
2. Copy the **entire contents** of the file
3. Paste into the SQL Editor
4. Click **"Run"** or press `Cmd+Enter` (Mac) or `Ctrl+Enter` (Windows)
5. Wait for execution to complete (should show "Success")

This runs three migrations:
- ✅ **020**: Add `store_id` to `product_variants`
- ✅ **021**: Core variant-level pricing schema
- ✅ **024**: Add `variant_id` to history and sales tables

### Step 3: Verify Phase 1 Success

Run this verification query in SQL Editor:

```sql
-- Verify all columns were added
SELECT 
  'product_variants' as table_name,
  COUNT(*) as total_rows,
  COUNT(store_id) as have_store_id,
  COUNT(starting_price) as have_starting,
  COUNT(current_price) as have_current
FROM product_variants

UNION ALL

SELECT 
  'pricing_config' as table_name,
  COUNT(*) as total_rows,
  COUNT(variant_id) as have_variant_id,
  COUNT(product_id) as have_product_id,
  COUNT(*) - COUNT(product_id) as variant_only
FROM pricing_config;
```

**Expected**: All counts should match for each row

### Step 4: Run Phase 2 Data Migration

After verifying Phase 1, run the data migration:

1. Open: `supabase/migrations/022_migrate_pricing_configs.sql`
2. Copy entire contents
3. Run in SQL Editor

**IMPORTANT**: The DELETE statement at the end is commented out. Keep it commented out until you verify the migration worked.

### Step 5: Verify Phase 2

Run this query:

```sql
-- Check that configs were migrated to variants
SELECT 
  p.title as product_title,
  pv.title as variant_title,
  pc.auto_pricing_enabled,
  pv.starting_price,
  pv.current_price
FROM pricing_config pc
JOIN product_variants pv ON pc.variant_id = pv.id
JOIN products p ON pv.product_id = p.id
WHERE pc.variant_id IS NOT NULL
LIMIT 10;
```

**Expected**: Should return pricing configs linked to variants

### Step 6: Run Phase 3 RLS Updates

1. Open: `supabase/migrations/023_update_rls_for_variants.sql`
2. Copy entire contents  
3. Run in SQL Editor

### Step 7: Final Verification

Run this comprehensive check:

```sql
-- Comprehensive verification
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'product_variants' AND column_name IN ('store_id', 'starting_price', 'current_price')
    ) THEN '✅ Phase 1 Columns' ELSE '❌ Phase 1 Columns' END as phase1_columns,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pricing_config WHERE variant_id IS NOT NULL
    ) THEN '✅ Phase 2 Data' ELSE '⚠️ Phase 2 Data (may be empty)' END as phase2_data,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'pricing_history' AND column_name = 'variant_id'
    ) THEN '✅ Phase 3 Schema' ELSE '❌ Phase 3 Schema' END as phase3_schema;
```

**Expected**: All should be ✅

## Next Steps After Migrations

Once all migrations are complete:

1. ✅ **Test Product Sync**: Click "Sync Products" button and verify variant prices populate
2. ✅ **Test Pricing Algorithm**: Click "Run Pricing Now" and verify it processes variants
3. ✅ **Check Logs**: Look for variant-level processing in console logs

## Troubleshooting

### Error: "column already exists"
✅ Safe to ignore - migrations use `IF NOT EXISTS` clauses

### Error: "foreign key constraint violation"
⚠️ Check that `product_variants` table exists and has data

### Error: "relation does not exist"
⚠️ Make sure you ran migration 020 before 021

### No data returned in Phase 2 verification
⚠️ This is normal if you don't have any products with pricing configs yet

## Files Reference

- `VARIANT_MIGRATION_COMBINED.sql` - Phase 1 schema (run first)
- `022_migrate_pricing_configs.sql` - Phase 2 data migration
- `023_update_rls_for_variants.sql` - Phase 3 RLS policies

## Support

If you encounter issues, check:
- Console logs for detailed error messages
- `VARIANT_LEVEL_PRICING_PHASE1-3_COMPLETE.md` for what was implemented
- `VARIANT_LEVEL_PRICING_IMPLEMENTATION.plan.md` for full plan

