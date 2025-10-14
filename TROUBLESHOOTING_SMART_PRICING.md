# Smart Pricing Toggle - Troubleshooting Guide

## Issue: "Failed to update smart pricing setting"

This error occurs when clicking the Smart Pricing toggle on the Products page. Here's how to diagnose and fix it:

---

## Step 1: Check if the Database Table Exists

### Option A: Use the Test Endpoint
1. Open your browser and navigate to:
   ```
   http://localhost:3000/api/settings/global-pricing/test
   ```

2. Check the response:
   - ✅ **Success**: You'll see `"success": true` and the table exists
   - ❌ **Error**: You'll see an error message indicating the table is missing

### Option B: Check Supabase Directly
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `wmqrvvuxioukuwvvtmpe`
3. Go to **SQL Editor** in the left sidebar
4. Run this query:
   ```sql
   SELECT * FROM global_settings;
   ```

**Expected Result:**
```
key                             | value | description
---------------------------------|-------|-------------
smart_pricing_global_enabled    | true  | Global toggle for smart pricing system...
```

**If you get an error like** `relation "global_settings" does not exist`:
→ **The migration hasn't been run yet** (continue to Step 2)

---

## Step 2: Run the Database Migration

### Instructions:
1. Open the migration file:
   ```
   supabase/migrations/002_add_global_settings.sql
   ```

2. Copy the entire contents of the file

3. Go to your Supabase Dashboard → **SQL Editor**

4. Click **"New query"**

5. Paste the migration SQL and click **"Run"**

6. You should see a success message

### Verify the Migration:
Run this query in the SQL Editor:
```sql
SELECT * FROM global_settings WHERE key = 'smart_pricing_global_enabled';
```

You should see one row with `value: true`

---

## Step 3: Test the API Endpoint

### Test in Browser DevTools:
1. Open your Products page: http://localhost:3000/products
2. Open browser DevTools (F12) → **Console** tab
3. Run this test:
   ```javascript
   // Test GET
   fetch('/api/settings/global-pricing')
     .then(r => r.json())
     .then(console.log)
     .catch(console.error);

   // Test PUT
   fetch('/api/settings/global-pricing', {
     method: 'PUT',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ enabled: false })
   })
     .then(r => r.json())
     .then(console.log)
     .catch(console.error);
   ```

**Expected Response:**
```json
{
  "success": true,
  "enabled": false,
  "message": "Smart pricing disabled globally"
}
```

---

## Step 4: Check Environment Variables

Verify your `.env.local` file has these variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://wmqrvvuxioukuwvvtmpe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**After making changes to `.env.local`:**
1. Stop the dev server (Ctrl+C)
2. Restart it: `npm run dev`

---

## Step 5: Check Browser Console for Errors

1. Open Products page: http://localhost:3000/products
2. Open DevTools (F12) → **Console** tab
3. Click the Smart Pricing toggle
4. Look for error messages

### Common Errors:

#### Error: "Failed to fetch"
**Cause:** API endpoint not accessible or dev server not running
**Solution:** Restart the dev server

#### Error: "Database table not found"
**Cause:** Migration not run
**Solution:** Follow Step 2 above

#### Error: "Unauthorized" or "Permission denied"
**Cause:** Invalid Supabase credentials
**Solution:** Check Step 4 (environment variables)

---

## Step 6: Check Network Tab

1. Open Products page
2. Open DevTools (F12) → **Network** tab
3. Click the Smart Pricing toggle
4. Look for a request to `/api/settings/global-pricing`

### What to check:
- **Status Code**: Should be `200 OK`
- **Response**: Should show `"success": true`
- **Request Payload**: Should show `{ "enabled": true/false }`

### Common Issues:

**Status 404:**
- API endpoint file missing
- Check: `src/app/api/settings/global-pricing/route.ts` exists

**Status 500:**
- Server error (check terminal logs)
- Database connection issue

**Status 503:**
- Database table doesn't exist
- Run the migration (Step 2)

---

## Step 7: Check Server Terminal Logs

Look at your terminal where the dev server is running. When you click the toggle, you should see:

**If successful:**
```
No errors
```

**If there's an error:**
```
Error updating global pricing setting: { ... }
Error details: {
  message: "relation 'global_settings' does not exist",
  code: "42P01"
}
```

This confirms the table is missing → Run the migration (Step 2)

---

## Quick Fix Script

Run this in your terminal to verify everything:

```bash
# Navigate to project directory
cd /Users/marcosbb310/Desktop/code/napoleonshopify3/napoleonshopify3

# Check if migration file exists
ls -la supabase/migrations/002_add_global_settings.sql

# Test the API endpoint
curl http://localhost:3000/api/settings/global-pricing/test

# Check environment variables
grep SUPABASE .env.local
```

---

## Still Not Working?

### Debug Checklist:
- [ ] Migration file exists: `supabase/migrations/002_add_global_settings.sql`
- [ ] Migration has been run in Supabase SQL Editor
- [ ] Table exists in database: `SELECT * FROM global_settings;`
- [ ] Environment variables are set in `.env.local`
- [ ] Dev server has been restarted after env changes
- [ ] No errors in browser console
- [ ] No errors in server terminal
- [ ] Test endpoint works: `/api/settings/global-pricing/test`

### Manual Database Setup

If the migration isn't working, you can manually create the table:

```sql
-- Run this in Supabase SQL Editor

-- Create the table
CREATE TABLE IF NOT EXISTS global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the default setting
INSERT INTO global_settings (key, value, description)
VALUES (
  'smart_pricing_global_enabled',
  'true'::jsonb,
  'Global toggle for smart pricing system. When disabled, no automated price changes will occur.'
)
ON CONFLICT (key) DO NOTHING;

-- Verify
SELECT * FROM global_settings;
```

---

## Success! ✅

Once everything is working, you should:
1. See the Smart Pricing toggle on the Products page
2. Be able to click it without errors
3. See a green toast notification: "Smart pricing enabled/disabled globally"
4. See the badge change between "ON" and "OFF"

---

## Need More Help?

1. **Check server logs** in your terminal for detailed error messages
2. **Check browser console** for client-side errors
3. **Test the endpoint directly** using the test URL or curl
4. **Verify database connection** in Supabase dashboard

The most common issue is that the migration hasn't been run yet. Make sure to complete Step 2!

