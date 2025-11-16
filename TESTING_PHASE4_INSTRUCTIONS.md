# Testing Phase 4 - Filtering Performance & React Query DevTools

## 🎯 What to Test

1. **Filtering Performance** - Filters should be instant (no loading spinner)
2. **React Query Cache** - Should see single cache entry per store
3. **Cache Invalidation** - Should work correctly after mutations

---

## 📋 Step-by-Step Testing Instructions

### 1. Start the Dev Server

```bash
npm run dev
```

### 2. Open Products Page

- Navigate to `http://localhost:3000/products`
- Wait for products to load (initial load will take 1-2 seconds)

### 3. Open React Query DevTools

- Look for a **floating button** in the bottom-left corner of the screen
- It should have a React Query logo (⚛️ or similar)
- Click it to open the DevTools panel
- **Alternative**: Press `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)

### 4. Check Cache Structure

In React Query DevTools:
- Click on **"Queries"** tab
- You should see a query with key: `["products", "your-store-id"]`
- **Expected**: Only ONE query entry per store (not multiple for different filters)
- **Note**: The store ID will be a UUID

### 5. Test Filtering Performance

#### Test Search Filter
1. Type in the search box (e.g., "shirt")
2. **Expected**: Results filter INSTANTLY (< 10ms)
3. **Check**: No loading spinner should appear
4. **Check DevTools**: Query key should still be `["products", "store-id"]` (same entry)

#### Test Vendor Filter
1. Select a vendor from the vendor filter dropdown
2. **Expected**: Results filter INSTANTLY
3. **Check**: No loading spinner
4. **Check DevTools**: Still same query entry

#### Test Price Range Filter
1. Adjust the price range slider
2. **Expected**: Results filter INSTANTLY
3. **Check**: No loading spinner
4. **Check DevTools**: Still same query entry

#### Test Sort Order
1. Change sort order (e.g., "Price: Low to High")
2. **Expected**: Results re-sort INSTANTLY
3. **Check**: No loading spinner
4. **Check DevTools**: Still same query entry

### 6. Test Cache Invalidation

#### Test After Sync
1. Click "Sync Products" button
2. Wait for sync to complete
3. **Check DevTools**: Query should show as "stale" or refetch
4. **Expected**: Products update after sync

#### Test After Price Update
1. Update a product price
2. **Check DevTools**: Query should invalidate and refetch
3. **Expected**: Updated price appears in list

### 7. Verify Network Requests

Open **Browser DevTools** → **Network** tab:
1. Clear network log
2. Change a filter (search, vendor, etc.)
3. **Expected**: NO network requests (filtering is client-side)
4. **Only**: Initial page load should show one request to fetch products

---

## ✅ Success Criteria

### Filtering Performance
- ✅ Filter changes are instant (< 10ms)
- ✅ No loading spinner on filter changes
- ✅ No network requests on filter changes

### React Query Cache
- ✅ Single cache entry: `["products", "store-id"]`
- ✅ No multiple entries for different filters
- ✅ Cache persists across filter changes

### Cache Invalidation
- ✅ Sync invalidates cache correctly
- ✅ Price update invalidates cache correctly
- ✅ Products refetch after mutations

---

## 🐛 Troubleshooting

### DevTools Not Showing?
- Make sure you're in **development mode** (`npm run dev`)
- DevTools only shows in development
- Try refreshing the page
- Check browser console for errors

### Still Seeing Loading Spinners?
- Check if filters are being passed to `useProducts` hook
- Verify server-side filtering was removed
- Check browser console for errors

### Multiple Cache Entries?
- Check query key in `useProducts.ts` - should be `['products', storeId]`
- Verify filters are not in query key
- Clear cache in DevTools and reload

### Network Requests on Filter Change?
- Check if client-side filtering is working
- Verify `useProducts` is not being called with filters
- Check browser console for errors

---

## 📊 Expected Performance Metrics

- **Initial Load**: 1-2 seconds (one-time database fetch)
- **Filter Changes**: < 10ms (instant, client-side)
- **Cache Hit**: 0ms (instant from cache)
- **Network Requests**: 0 on filter changes (only on initial load or mutations)

---

## 🎯 What You Should See in DevTools

### Query Structure
```
Queries
└── ["products", "store-uuid-here"]
    ├── Status: success
    ├── Data: [array of products]
    ├── Data Updated: [timestamp]
    └── Observers: 1
```

### After Filter Change
- Same query entry
- No new queries created
- Data stays the same (filtering happens in component)

### After Sync/Update
- Query shows as "stale" or "fetching"
- Then updates with new data
- Still same query key

---

## 💡 Tips

1. **DevTools Position**: You can drag the DevTools panel to reposition it
2. **Query Details**: Click on a query to see full details (data, status, etc.)
3. **Clear Cache**: Use DevTools to manually clear cache for testing
4. **Network Tab**: Keep Network tab open to verify no requests on filter changes

---

## 📝 Notes

- DevTools only works in development mode
- Production builds won't include DevTools
- Cache persists during the session
- Clearing browser cache will clear React Query cache too

