# How to Fix Browser Cache Issue

## Simple Solution:

**Close your browser tab and open a new one:**

1. Press `Cmd + W` to close the current tab
2. Press `Cmd + T` to open a new tab
3. Go to `http://localhost:3000/products`
4. Try clicking "Sync Products" again

## Or Use Incognito Mode:

1. Press `Cmd + Shift + N` (opens incognito window)
2. Go to `http://localhost:3000/products`
3. Log in
4. Try clicking "Sync Products"

## Why This Works:

Your browser has cached the old JavaScript code that calls `/api/shopify/sync-products`. 
By closing the tab or using incognito mode, you bypass the cache and load the fresh code.

## After You Do This:

The sync should work! You should see in the terminal:
```
POST /api/shopify/sync 200 in XXXms
```

Instead of:
```
POST /api/shopify/sync-products 404
```

