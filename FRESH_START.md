# Fresh Start Instructions - Node.js v24 + Auth Migration

## The Issue
You're running **Node.js v24** which has a critical bug on macOS that crashes Next.js dev server. Additionally, Turbopack caching is causing old auth code to persist.

## Permanent Solution (Recommended)

### Downgrade to Node.js 22 LTS

Node.js 22 is the current LTS version and works perfectly with Next.js:

```bash
# Using nvm (recommended)
nvm install 22
nvm use 22
nvm alias default 22

# Or using brew
brew install node@22
brew link node@22 --force --overwrite
```

Then start normally:
```bash
cd napoleonshopify3
npm run dev
```

## Temporary Solution (If you must use Node v24)

I've already applied these fixes:

1. ✅ Disabled Turbopack (added to `next.config.ts`)
2. ✅ Added Node.js DNS fix to package.json
3. ✅ Fixed all auth imports

### To Start Server

Run these commands **exactly** in order:

```bash
# 1. Navigate to project
cd /Users/marcosbb310/Desktop/code/napoleonshopify3/napoleonshopify3

# 2. Kill ALL node processes (important!)
pkill -9 node
sleep 2

# 3. Clear everything
rm -rf .next
rm -rf node_modules/.cache

# 4. Start fresh
npm run dev
```

The server should start on http://localhost:3000

### If Still Getting Errors

Try a **complete reinstall**:

```bash
cd /Users/marcosbb310/Desktop/code/napoleonshopify3/napoleonshopify3

# Nuclear option - reinstall everything
rm -rf node_modules
rm -rf .next
rm package-lock.json
npm cache clean --force
npm install
npm run dev
```

## Why Node.js v24 Causes Issues

Node.js v24 has a bug with `os.networkInterfaces()` on macOS:
- Error: `uv_interface_addresses returned Unknown system error 1`
- Affects: Next.js dev server network detection
- Status: Open issue, not yet fixed
- Solution: Use Node.js 22 LTS

## Verify Your Setup

After starting the server successfully:

1. ✅ No `uv_interface_addresses` errors
2. ✅ Server starts on port 3000
3. ✅ No "Can't find variable: useAuthNew" errors
4. ✅ Pages load without internal server errors

## Quick Checklist

- [ ] Node.js version checked: `node -v` (should be 22.x.x or lower)
- [ ] All node processes killed: `pkill -9 node`
- [ ] Cache cleared: `rm -rf .next`
- [ ] Server started: `npm run dev`
- [ ] Browser hard refresh: Cmd+Shift+R (clear browser cache)
- [ ] Landing page loads: http://localhost:3000
- [ ] Products page works: http://localhost:3000/products

## Still Having Issues?

1. **Check what's actually running:**
   ```bash
   lsof -i:3000
   ```

2. **Check Node.js version:**
   ```bash
   node -v
   # Should be v22.x.x for best compatibility
   ```

3. **Hard refresh browser:**
   - Chrome/Edge: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - Clear Application → Storage in DevTools

4. **Check for hidden processes:**
   ```bash
   ps aux | grep node
   # Kill any that show "next dev"
   ```

## What We Fixed

✅ All auth imports updated to use new `useAuth` (not `useAuthNew`)
✅ Token handling supports both encrypted and plain text
✅ Products page waits for store to load before fetching
✅ Node.js DNS workaround added to package.json
✅ Turbopack disabled to prevent caching issues

## Final Notes

- **Node.js 22 LTS** is the recommended version for this project
- Node.js 24 is experimental and has known issues
- If you must use v24, expect occasional crashes
- All auth migration issues are fixed in the code

