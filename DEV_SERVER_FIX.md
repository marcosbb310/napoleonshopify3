# Dev Server Fix - Node.js v24 Compatibility

## Problem
Getting this error when starting dev server:
```
NodeError [SystemError]: A system error occurred: uv_interface_addresses returned Unknown system error 1
```

## Root Cause
Node.js v24 on macOS has a known issue with the `os.networkInterfaces()` API, which Next.js uses to detect network addresses for the dev server.

## Solution Applied

### Option 1: Updated package.json (✅ Applied)
Modified the `dev` script to include Node.js DNS flag:
```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='--dns-result-order=ipv4first' next dev --turbopack"
  }
}
```

This tells Node.js to prefer IPv4 addresses, which avoids the network interface error.

### Option 2: Manual Start (if needed)
If the package.json fix doesn't work, start manually:
```bash
NODE_OPTIONS='--dns-result-order=ipv4first' npm run dev
```

### Option 3: Downgrade Node.js (last resort)
If issues persist, downgrade to Node.js v22 LTS:
```bash
# Using nvm
nvm install 22
nvm use 22

# Or using brew
brew install node@22
```

## How to Start Dev Server Now

Simply run:
```bash
npm run dev
```

The server should start on http://localhost:3000 without errors.

## Related Issues
- Node.js Issue: https://github.com/nodejs/node/issues/52256
- Next.js Discussion: https://github.com/vercel/next.js/issues/67763

## Verification
After starting the server, you should see:
```
✓ Starting...
✓ Ready in Xms
○ Local:        http://localhost:3000
```

No errors about `uv_interface_addresses` should appear.

