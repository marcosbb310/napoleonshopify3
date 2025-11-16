# Sync Verification Guide

## 🔍 How to Verify Sync is Actually Working

I've added comprehensive logging to help debug why images aren't being saved. Here's how to verify:

### Step 1: Run a Sync
1. Go to your products page
2. Click "Sync Products" button
3. Watch the **server console logs** (not browser console)

### Step 2: Check the Logs

Look for these log messages in order:

#### 🖼️ ShopifyClient Logs (Images from Shopify API)
```
🖼️  ShopifyClient: Product "Product Name" images from API:
   - rawImagesCount: X
   - transformedImagesCount: X
   - firstImageSrc: "https://cdn.shopify.com/..."
```

**What to check:**
- ✅ If `rawImagesCount > 0`: Shopify API is returning images
- ❌ If `rawImagesCount = 0`: Products don't have images in Shopify

#### 🖼️ SyncProducts Logs (Before Upsert)
```
🖼️  SyncProducts: Product "Product Name" images:
   - hasImages: true/false
   - imageCount: X
   - firstImageSrc: "https://..."
```

**What to check:**
- ✅ If `hasImages = true`: Images are being passed to sync
- ❌ If `hasImages = false`: Images are lost between ShopifyClient and sync

#### 🔄 SyncProducts Logs (Upsert Data)
```
🔄 SyncProducts: About to upsert X products
🖼️  SyncProducts: First product images in upsert: [...]
```

**What to check:**
- ✅ If images array has items: Data is ready to save
- ❌ If images array is empty: Data is lost before upsert

#### ✅ SyncProducts Logs (After Upsert)
```
✅ SyncProducts: Upserted X products
🖼️  SyncProducts: Products with images after upsert: X/Y
```

**What to check:**
- ✅ If `X/Y > 0`: Images were saved successfully
- ❌ If `X/Y = 0`: Images weren't saved (check error logs)

### Step 3: Verify in Database

After sync completes, run:
```bash
node verify-images.js
```

This will show:
- How many products have images
- Sample image data
- Whether images were actually saved

### Step 4: Common Issues

#### Issue 1: No images from Shopify API
**Symptom:** `rawImagesCount = 0` in ShopifyClient logs
**Solution:** Products in Shopify don't have images assigned

#### Issue 2: Images lost during transformation
**Symptom:** `rawImagesCount > 0` but `transformedImagesCount = 0`
**Solution:** Check image transformation logic in ShopifyClient

#### Issue 3: Images lost before upsert
**Symptom:** `transformedImagesCount > 0` but upsert array is empty
**Solution:** Check product mapping in syncProducts.ts

#### Issue 4: Upsert not saving images
**Symptom:** Upsert array has images but database doesn't
**Solution:** Check database constraints or RLS policies

### Step 5: Manual Test

If sync isn't working, test manually:
```bash
node test-sync-flow.js
```

This will:
- Check if images column exists
- Test manual image update
- Verify database can save images

## 📋 Quick Checklist

- [ ] Run sync and check server logs
- [ ] Verify ShopifyClient receives images
- [ ] Verify images reach syncProducts
- [ ] Verify images are in upsert data
- [ ] Verify images are saved to database
- [ ] Run verify-images.js to confirm

## 🐛 Debugging Commands

```bash
# Check current state
node verify-images.js

# Test sync flow
node test-sync-flow.js

# Check specific product
# (Run SQL in Supabase Dashboard)
SELECT id, title, images FROM products WHERE shopify_id = 'YOUR_PRODUCT_ID';
```

