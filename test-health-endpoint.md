# Testing Health Check Endpoint

## Issue: 404 Error

The endpoint is returning 404 because Next.js dev server needs to detect the new route. This is normal for newly created API routes.

## Solution: Restart Dev Server

**Option 1: Restart Next.js Dev Server**
1. Stop your current dev server (Ctrl+C)
2. Restart it: `npm run dev` or `yarn dev`
3. Wait for compilation to complete
4. Try the endpoint again

**Option 2: Wait for Hot Reload**
- Sometimes Next.js picks up new routes automatically
- Wait 10-30 seconds and try again
- Check the terminal for compilation messages

## Test Commands

Once the server has picked up the route, use these commands:

### Simple Test
```bash
curl http://localhost:3000/api/system/health/products
```

### Pretty Print (if you have jq)
```bash
curl -s http://localhost:3000/api/system/health/products | jq
```

### Using the Test Script
```bash
./test-health-check.sh
```

## Expected Response

Once working, you should see:
```json
{
  "ok": true,
  "nullIds": 0,
  "emptyIds": 0,
  "invalidStringIds": 0,
  "activeNullIds": 0,
  "totalProducts": 150,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Troubleshooting

If still getting 404 after restart:
1. Check that the file exists: `ls -la src/app/api/system/health/products/route.ts`
2. Check for syntax errors in the route file
3. Clear Next.js cache: `rm -rf .next`
4. Restart dev server again

## Alternative: Test via Browser

Open in browser:
```
http://localhost:3000/api/system/health/products
```

This will show the JSON response directly.

