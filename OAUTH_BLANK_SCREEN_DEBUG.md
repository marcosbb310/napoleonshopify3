# OAuth Blank Screen Debugging Guide

## Problem
OAuth callback opens a blank page with NO logs in terminal, even though we have extensive logging.

## Possible Causes

1. **Route Handler Not Executing**
   - Next.js routing issue
   - File not being compiled/loaded
   - Syntax error preventing compilation

2. **Response Not Reaching Browser**
   - Network/proxy blocking
   - CORS issue
   - Browser blocking content

3. **HTML Not Rendering**
   - JavaScript error preventing render
   - Browser security blocking
   - X-Frame-Options issue (FIXED - now set to SAMEORIGIN)

## Diagnostic Steps

### 1. Check if Route is Accessible
```bash
curl -v "http://localhost:3000/api/auth/shopify/v2/callback?code=test&state=test&shop=test.myshopify.com&hmac=test"
```

### 2. Check Server Logs
Look for:
- `🔵🔵🔵 OAuth callback route EXECUTING`
- Any errors before this log

### 3. Check Browser Console
Open DevTools → Console and look for:
- JavaScript errors
- Network errors
- Content Security Policy violations

### 4. Check Network Tab
In DevTools → Network:
- Is the request reaching the server?
- What's the response status code?
- What's the response body?

## Changes Made

1. ✅ Added `X-Frame-Options: SAMEORIGIN` to allow popup rendering
2. ✅ Added extensive logging at route entry point
3. ✅ Wrapped all async operations in try-catch
4. ✅ Enhanced error pages to be visible

## Next Steps

If still blank:
1. Check if the route handler file is actually being loaded
2. Check for TypeScript compilation errors
3. Restart the Next.js dev server
4. Check browser console for JavaScript errors

