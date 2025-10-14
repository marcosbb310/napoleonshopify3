# 🔄 Migration: Convert Period from Days to Hours

## What This Does

Changes the pricing cycle from **days** to **hours** for more granular control.

### Benefits:
- ✅ More flexible testing (can set to 1 hour instead of 1 day)
- ✅ Faster iteration during development
- ✅ More precise control in production
- ✅ Better for time-sensitive pricing strategies

### Changes:
- `period_days` (default: 2) → `period_hours` (default: 48)
- All calculations now use hours instead of days

---

## 📋 How to Apply This Migration

### Option 1: Supabase SQL Editor (Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project: `wmqrvvuxioukuwvvtmpe`

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy the Migration SQL**
   - Open: `supabase/migrations/004_convert_period_to_hours.sql`
   - Copy the entire contents

4. **Paste and Run**
   - Paste into SQL Editor
   - Click "Run" button
   - Wait for success message

5. **Verify**
   - Run this query to check:
   ```sql
   SELECT id, product_id, period_hours, next_price_change_date 
   FROM pricing_config 
   LIMIT 5;
   ```
   - You should see `period_hours` column with values (48 = 2 days)

---

### Option 2: Manual SQL Execution

If you prefer running SQL manually, here's the complete migration:

```sql
-- Step 1: Add new period_hours column
ALTER TABLE pricing_config ADD COLUMN period_hours INTEGER;

-- Step 2: Convert existing values (days * 24 = hours)
UPDATE pricing_config SET period_hours = period_days * 24 WHERE period_days IS NOT NULL;

-- Step 3: Set default value (48 hours = 2 days)
ALTER TABLE pricing_config ALTER COLUMN period_hours SET DEFAULT 48;

-- Step 4: Make NOT NULL
ALTER TABLE pricing_config ALTER COLUMN period_hours SET NOT NULL;

-- Step 5: Drop old column
ALTER TABLE pricing_config DROP COLUMN period_days;

-- Step 6: Update any NULL next_price_change_date values
UPDATE pricing_config
SET next_price_change_date = 
  CASE 
    WHEN last_price_change_date IS NOT NULL 
    THEN last_price_change_date + (period_hours || ' hours')::INTERVAL
    ELSE NOW() + (period_hours || ' hours')::INTERVAL
  END
WHERE next_price_change_date IS NULL;
```

---

## ✅ What Was Updated in Code

All code has been updated to use `period_hours`:

### Files Changed:
1. ✅ `supabase/migrations/001_initial_schema.sql` - Updated default
2. ✅ `supabase/migrations/003_add_next_price_change_date.sql` - Updated calculations  
3. ✅ `supabase/migrations/004_convert_period_to_hours.sql` - NEW migration file
4. ✅ `src/features/pricing-engine/services/pricingAlgorithm.ts` - Updated all calculations
5. ✅ `src/features/shopify-integration/services/syncProducts.ts` - Updated default value
6. ✅ `src/app/api/pricing/config/[productId]/route.ts` - Updated API field

---

## 🧪 Testing After Migration

1. **Restart Dev Server**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Check Database**
   Visit http://localhost:3001 and verify:
   - Products load correctly
   - Pricing config shows hours (not days)

3. **Test Fast Pricing Cycle**
   Update a product's config to test quickly:
   ```sql
   -- Set pricing cycle to 1 hour for testing
   UPDATE pricing_config 
   SET period_hours = 1,
       next_price_change_date = NOW() + INTERVAL '1 hour'
   WHERE product_id = 'YOUR_PRODUCT_ID';
   ```

4. **Manual Trigger Test**
   ```bash
   curl -X POST http://localhost:3001/api/pricing/run
   ```

---

## 📊 Example Values

| Old (Days) | New (Hours) | Description |
|------------|-------------|-------------|
| 2 days | 48 hours | Default cycle (recommended) |
| 1 day | 24 hours | Daily pricing |
| 12 hours | 12 hours | Twice daily |
| 1 hour | 1 hour | Fast testing |
| 7 days | 168 hours | Weekly cycle |

---

## 🔧 Common Settings

### For Development (Fast Testing):
```sql
UPDATE pricing_config SET period_hours = 1;  -- 1 hour cycle
```

### For Production (Default):
```sql
UPDATE pricing_config SET period_hours = 48;  -- 2 day cycle
```

### For Aggressive Pricing:
```sql
UPDATE pricing_config SET period_hours = 12;  -- 12 hour cycle
```

---

## 🚨 Troubleshooting

### Error: "column period_days does not exist"
✅ Migration successful! The column was renamed.

### Error: "column period_hours already exists"  
✅ Migration already applied. No action needed.

### Products not loading
1. Check Supabase connection
2. Verify migration ran successfully
3. Restart dev server

---

## ✨ You're Done!

After running the migration:
- ✅ All code uses hours instead of days
- ✅ More flexible pricing cycles
- ✅ Can test with 1-hour cycles
- ✅ Production-ready with 48-hour default

**Next Steps:**
1. Run the migration in Supabase SQL Editor
2. Restart your dev server
3. Test the pricing algorithm with faster cycles!

