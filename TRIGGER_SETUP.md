# Trigger.dev Integration Setup Complete! 🎉

This document explains the Trigger.dev integration that has been added to your smart pricing application.

## 📦 What Was Installed

### Dependencies Added:
- `@trigger.dev/sdk@4.0.4` - Trigger.dev v4 SDK
- `@trigger.dev/cli@3.3.12` - CLI tools for development and deployment

### Scripts Added to package.json:
```json
"trigger:dev": "trigger-dev dev",
"trigger:deploy": "trigger-dev deploy"
```

## 📁 Files Created

### 1. `trigger.config.ts` (Root)
Configuration file for Trigger.dev project settings:
- Project name: "Napoleonshopify3"
- Task directories: `./src/trigger`
- Retry configuration
- Max duration: 1 hour

### 2. `src/trigger/daily-pricing.ts`
Scheduled task that runs your pricing algorithm daily at 2 AM UTC.

**What it does:**
- Calls your existing `runPricingAlgorithm()` function
- Processes all products where `next_price_change_date <= today`
- Logs results to console and Trigger.dev dashboard
- Throws error if algorithm fails (triggers retry)

**Cron schedule:** `0 2 * * *` (2 AM UTC daily)

### 3. `src/trigger/index.ts`
Exports all Trigger.dev tasks (barrel export pattern)

### 4. `src/app/api/webhooks/shopify/product-update/route.ts`
Webhook endpoint that receives Shopify product update notifications.

**What it does:**
- Verifies webhook authenticity using HMAC signature
- Extracts new price from product data
- Updates `pricing_config` in Supabase
- Resets `next_price_change_date` to today + 2 days
- Ensures manual price changes are respected by the algorithm

## 🔐 Environment Variables Required

Add these to your `.env.local` file:

```bash
# Trigger.dev Secret Key
# Get from: https://cloud.trigger.dev → Your Project → API Keys
TRIGGER_SECRET_KEY=tr_dev_xxxxx

# Shopify Webhook Secret  
# Get from: Shopify Admin → Settings → Notifications → Webhooks → Create webhook
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here
```

**Note:** Your existing Supabase and Shopify variables should already be set.

## 🚀 How to Test Locally

### Step 1: Start Next.js Development Server
```bash
npm run dev
```

### Step 2: Start Trigger.dev Development Server (New Terminal)
```bash
npm run trigger:dev
```

This will:
- Connect to Trigger.dev cloud
- Watch for task files in `src/trigger/`
- Make your scheduled task available for testing
- Show logs in terminal

### Step 3: Test the Webhook (New Terminal)
```bash
curl -X POST http://localhost:3000/api/webhooks/shopify/product-update \
  -H "Content-Type: application/json" \
  -d '{
    "id": "123456789",
    "title": "Test Product",
    "variants": [{"price": "29.99"}]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "productId": "123456789",
  "newPrice": 29.99,
  "nextPriceChangeDate": "2025-10-15T..."
}
```

### Step 4: Manually Trigger the Daily Pricing Task

In the Trigger.dev dashboard (https://cloud.trigger.dev), you can:
1. Go to your project "Napoleonshopify3"
2. Find "daily-pricing-optimization" task
3. Click "Test" to trigger it manually
4. View real-time logs and execution details

## 📊 How It Works Together

### Scenario 1: Normal Automated Flow (No Manual Changes)
```
Day 1, 2 AM: Algorithm runs → Increases Product A price ($10 → $10.50)
             Sets next_price_change_date = Day 3

Day 2, 2 AM: Algorithm runs → Skips Product A (not due yet)

Day 3, 2 AM: Algorithm runs → Product A is due → Increases price again ($10.50 → $11.03)
```

### Scenario 2: Manual Price Change via Shopify
```
Day 1, 2 AM: Algorithm sets Product A to $10.50, next change = Day 3

Day 2, 10 AM: Merchant manually changes Product A to $12.00 in Shopify
              ↓
              Webhook fires → Updates database:
              - current_price = $12.00
              - next_price_change_date = Day 4 (reset to +2 days)

Day 3, 2 AM: Algorithm runs → Skips Product A (next_price_change_date = Day 4, not yet)

Day 4, 2 AM: Algorithm runs → Product A is due → Increases from $12.00
```

**Key Point:** Webhook and cron never "talk" to each other. The `next_price_change_date` field coordinates everything automatically!

## 🔧 Shopify Webhook Configuration

To receive real product updates from Shopify (not just test data), you need to register the webhook in Shopify Admin:

1. **Go to:** Shopify Admin → Settings → Notifications → Webhooks
2. **Click:** "Create webhook"
3. **Configure:**
   - **Event:** Product update
   - **Format:** JSON
   - **URL:** `https://yourdomain.com/api/webhooks/shopify/product-update`
   - **API version:** 2024-10

4. **Copy webhook secret** from Shopify and add to `.env.local`:
   ```bash
   SHOPIFY_WEBHOOK_SECRET=paste_secret_here
   ```

**For local testing:** Use Shopify CLI or tools like ngrok to forward webhooks to localhost.

## 🌐 Deploying to Production

### Step 1: Deploy Trigger.dev Tasks
```bash
npm run trigger:deploy
```

This uploads your tasks to Trigger.dev cloud. They will run automatically on schedule.

### Step 2: Deploy Next.js App (Vercel)
```bash
git add .
git commit -m "Add Trigger.dev integration"
git push
```

Vercel will auto-deploy if connected to your repo.

### Step 3: Add Environment Variables to Vercel
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `TRIGGER_SECRET_KEY` (get **prod** key from Trigger.dev dashboard)
   - `SHOPIFY_WEBHOOK_SECRET`
   - (All other existing variables)

### Step 4: Update Shopify Webhook URL
Change webhook URL in Shopify Admin to your production domain:
```
https://yourdomain.com/api/webhooks/shopify/product-update
```

## 📈 Monitoring & Debugging

### Trigger.dev Dashboard
- **URL:** https://cloud.trigger.dev
- **Features:**
  - View all task runs (success/failure)
  - See detailed logs for each execution
  - Manually trigger tasks
  - View run history and statistics
  - Set up alerts

### Console Logs
The daily pricing task logs to console:
- 🚀 Starting message
- ✅ Success with stats
- ❌ Errors with details

### Webhook Logs
The webhook endpoint logs:
- 📦 Product received
- 💰 New price detected
- ✅ Database updated
- ❌ Any errors

## 🎯 Success Criteria

Your integration is working if:

✅ `npm run trigger:dev` connects successfully  
✅ Trigger.dev dashboard shows "daily-pricing-optimization" task  
✅ Webhook returns 200 status on test curl  
✅ Database `pricing_config` updates when webhook fires  
✅ Daily task shows in Trigger.dev dashboard runs  

## 🆘 Troubleshooting

### Issue: "Task not found" in Trigger.dev dashboard
**Solution:** Make sure `npm run trigger:dev` is running and shows task registration

### Issue: Webhook returns 401 "Invalid signature"
**Solution:** 
- Check `SHOPIFY_WEBHOOK_SECRET` in `.env.local`
- For local testing, you can temporarily skip HMAC verification

### Issue: "runPricingAlgorithm is not a function"
**Solution:** Check that `src/features/pricing-engine/index.ts` exports the function

### Issue: Schedule doesn't trigger
**Solution:**
- Dev: `npm run trigger:dev` must be running
- Prod: Task must be deployed with `npm run trigger:deploy`

## 📚 Architecture Benefits

### ✅ Separation of Concerns
- **Business logic:** `src/features/pricing-engine/pricingAlgorithm.ts` (unchanged!)
- **Scheduling:** `src/trigger/` (Trigger.dev tasks)
- **Webhooks:** `src/app/api/webhooks/` (Next.js API routes)

### ✅ No Timeouts
- Vercel serverless functions: 10-60 sec limit
- Trigger.dev: Unlimited execution time (up to 1 hour configured)
- Can handle stores with 1000+ products

### ✅ Automatic Retries
- If algorithm fails, Trigger.dev retries 3x automatically
- Exponential backoff between retries
- Configurable in `trigger.config.ts`

### ✅ Observable
- Every run logged in dashboard
- See exactly when prices changed
- Debug failures easily

## 🔄 What's Next?

Now that Trigger.dev is set up, you can:

1. **Test locally** - Run the dev servers and verify everything works
2. **Deploy to production** - Follow deployment steps above
3. **Add more scheduled tasks** - Create new files in `src/trigger/`
4. **Set up alerts** - Configure Trigger.dev to notify you on failures
5. **Monitor performance** - Track algorithm success rate in dashboard

## 📞 Need Help?

- **Trigger.dev Docs:** https://trigger.dev/docs
- **Trigger.dev Discord:** https://trigger.dev/discord
- **Your SESSION_SUMMARY.md:** Contains project history and context

---

**Integration completed on:** October 13, 2025  
**Trigger.dev Version:** v4.0.4  
**Status:** ✅ Ready for testing

