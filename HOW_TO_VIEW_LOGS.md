# How to View Sync Logs

## 🔍 Where to Find Logs

### Browser Console (Client-Side Logs)
**These logs appear in your browser's developer console:**

1. Open your browser's Developer Tools:
   - **Chrome/Edge**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - **Firefox**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - **Safari**: Enable Developer menu first, then `Cmd+Option+I`

2. Go to the **Console** tab

3. Run a sync and look for:
   - `🔵 SYNC MUTATION:` - Client-side sync logs
   - `🖼️  SYNC MUTATION: Image Debug Info:` - Image statistics after sync
   - `⚠️  SYNC MUTATION:` - Warnings if images aren't saved

### Terminal/Server Logs (Server-Side Logs)
**These logs appear in the terminal where you run `npm run dev`:**

1. Find the terminal window where you started the dev server
2. Look for logs with these prefixes:
   - `🟢 SYNC API:` - API route logs
   - `🖼️  ShopifyClient:` - Images from Shopify API
   - `🖼️  SyncProducts:` - Images during sync process
   - `✅ SyncProducts:` - Images after database save

### If You Don't See Server Logs

**Option 1: Check if server is running**
```bash
# Check if Next.js is running
lsof -i :3000

# Or start the server
npm run dev
```

**Option 2: Check log files**
```bash
# Check if there's a log file
ls -la *.log
cat dev-output.log  # if it exists
```

**Option 3: Use Browser Console**
The browser console now shows image debug info after sync, so you can see:
- How many products have images
- Sample image data
- Warnings if images aren't being saved

## 📊 What to Look For

### After Running Sync, Check Browser Console:

```
🖼️  SYNC MUTATION: Image Debug Info:
   - productsWithImages: X
   - totalProductsChecked: Y
   - sampleProductImages: [...]
```

**If `productsWithImages = 0`:**
- Images aren't being saved
- Check server logs for detailed error messages
- Run `node verify-images.js` to confirm

**If `productsWithImages > 0`:**
- Images are being saved! ✅
- Check if ProductCard is displaying them correctly

## 🐛 Debugging Steps

1. **Run sync** → Check browser console for `🖼️` logs
2. **If images = 0** → Check server terminal for detailed logs
3. **Run verification** → `node verify-images.js`
4. **Check database** → Run SQL query in Supabase Dashboard

## 💡 Quick Test

After sync, open browser console and you should see:
```
🖼️  SYNC MUTATION: Image Debug Info: {
  productsWithImages: X,
  totalProductsChecked: Y,
  sampleProductImages: [...]
}
```

This tells you immediately if images were saved!

