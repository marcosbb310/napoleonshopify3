# Shopify Integration Testing Guide

## Prerequisites
- Shopify Development Store (free from Partners account)
- App installed in development store
- Environment variables configured

## Test Scenarios

### 1. Product Fetching Test
**Goal**: Verify products load from real Shopify store

**Steps**:
1. Navigate to Products page
2. Verify products display with real data
3. Check that images, prices, variants show correctly
4. Test search and filtering functionality

**Expected Results**:
- Products load within 2 seconds
- All product data displays correctly
- No console errors

### 2. Price Update Test
**Goal**: Verify price updates push to Shopify

**Steps**:
1. Enable smart pricing for a test product
2. Manually trigger algorithm via API:
   ```bash
   curl -X POST http://localhost:3000/api/pricing/run \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie"
   ```
3. Check Shopify admin - price should update within 30 seconds
4. Verify database `pricing_history` table has new entry

**Expected Results**:
- Price updates in Shopify admin
- Database records the change
- No API errors

### 3. Webhook Integration Test
**Goal**: Verify webhooks work when prices change manually in Shopify

**Steps**:
1. Note current price of a product in your app
2. Manually change price in Shopify admin
3. Check webhook debug endpoint:
   ```bash
   curl http://localhost:3000/api/webhooks/shopify/test \
     -H "Cookie: your-session-cookie"
   ```
4. Verify app database shows new price
5. Check `next_price_change_date` is reset to +2 days

**Expected Results**:
- Webhook received (check server logs)
- Database updated with new price
- Algorithm cycle reset

### 4. Product Sync Test
**Goal**: Verify new products appear in app

**Steps**:
1. Add new product in Shopify admin
2. Click "Sync Products" button in app
3. Verify new product appears in product list
4. Check that pricing config is created

**Expected Results**:
- New product appears within 30 seconds
- Pricing config initialized
- No sync errors

### 5. Error Handling Test
**Goal**: Verify graceful error handling

**Test Cases**:
- Invalid Shopify credentials
- Network timeout
- Rate limit exceeded
- Webhook signature mismatch
- Database connection failure

**Expected Results**:
- Errors logged but don't crash app
- User sees appropriate error messages
- App remains functional

### 6. Performance Test
**Goal**: Verify performance with large product catalogs

**Steps**:
1. Create 100+ test products in Shopify
2. Sync all products
3. Test product list loading time
4. Test bulk price updates

**Expected Results**:
- Product list loads within 5 seconds
- Bulk operations complete within 2 minutes
- No memory leaks or crashes

## Debugging Tools

### Webhook Debug Endpoint
```bash
# Check webhook status
curl http://localhost:3000/api/webhooks/shopify/test

# Send test webhook
curl -X POST http://localhost:3000/api/webhooks/shopify/test \
  -H "Content-Type: application/json" \
  -d '{"action": "test_webhook"}'
```

### Database Queries
```sql
-- Check sync status
SELECT * FROM sync_status WHERE store_id = 'your-store-id';

-- Check recent webhooks
SELECT * FROM processed_webhooks 
WHERE store_id = 'your-store-id' 
ORDER BY processed_at DESC LIMIT 10;

-- Check pricing history
SELECT * FROM pricing_history 
WHERE product_id IN (
  SELECT id FROM products WHERE store_id = 'your-store-id'
) ORDER BY timestamp DESC LIMIT 10;
```

### Log Monitoring
```bash
# Watch logs in development
npm run dev | grep -E "(webhook|sync|error)"

# Check specific log levels
npm run dev | grep -E "\[ERROR\]"
```

## Common Issues & Solutions

### Issue: Webhooks not received
**Symptoms**: Manual price changes in Shopify don't update app
**Solutions**:
1. Check webhook registration: `GET /api/webhooks/shopify/test`
2. Verify `SHOPIFY_WEBHOOK_SECRET` is set
3. Check webhook URL is accessible from internet
4. Verify webhook is registered in Shopify admin

### Issue: Sync fails
**Symptoms**: Products don't appear after OAuth
**Solutions**:
1. Check sync status: Database `sync_status` table
2. Verify store access token is valid
3. Check Shopify API rate limits
4. Review error logs

### Issue: Rate limit errors
**Symptoms**: 429 errors from Shopify API
**Solutions**:
1. Check rate limiter is working
2. Reduce batch sizes
3. Add delays between requests
4. Consider GraphQL migration

### Issue: Algorithm overwrites manual changes
**Symptoms**: Manual price changes get reverted
**Solutions**:
1. Check webhook processing logs
2. Verify `next_price_change_date` is being reset
3. Check for webhook processing errors
4. Ensure idempotency is working
