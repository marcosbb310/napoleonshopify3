# Global Smart Pricing Toggle - Setup Instructions

## Overview
A global smart pricing toggle has been added to the Products page that allows you to turn the entire smart pricing system on or off. When disabled, no automated price changes will occur.

## Database Migration

### Step 1: Run the Migration
Execute the following SQL migration in your Supabase SQL Editor:

```bash
# Location: supabase/migrations/002_add_global_settings.sql
```

This creates:
- A `global_settings` table for system-wide configurations
- An initial setting `smart_pricing_global_enabled` set to `true` by default

### Step 2: Verify the Migration
Run this query to confirm the setting exists:

```sql
SELECT * FROM global_settings WHERE key = 'smart_pricing_global_enabled';
```

You should see a row with the value `true`.

## Features

### 1. Global Toggle Button
- **Location**: Products page header, next to the "Products" title
- **Visual**: Shows a Zap icon, "Smart Pricing" label, and ON/OFF badge
- **Functionality**: Click the switch to enable/disable smart pricing globally

### 2. Real-time Sync
- Toggle state is stored in the database
- Changes are immediately persisted
- Toast notifications confirm the action

### 3. Algorithm Respects Global Setting
- The pricing algorithm checks the global setting before processing any products
- If disabled, the algorithm exits early with message: "Global smart pricing is disabled"
- Individual product settings still work, but are overridden when global is OFF

### 4. Per-Product Controls
- Individual products can still have their own smart pricing toggles
- When global is OFF, all products are effectively disabled
- When global is ON, individual product settings apply

## API Endpoints

### GET `/api/settings/global-pricing`
Returns the current global smart pricing state:
```json
{
  "enabled": true
}
```

### PUT `/api/settings/global-pricing`
Updates the global smart pricing state:
```json
{
  "enabled": false
}
```

Response:
```json
{
  "success": true,
  "enabled": false,
  "message": "Smart pricing disabled globally"
}
```

## Technical Implementation

### Files Changed/Created:

1. **Database Migration**
   - `supabase/migrations/002_add_global_settings.sql`
   - Creates global_settings table with key-value structure

2. **API Endpoint**
   - `src/app/api/settings/global-pricing/route.ts`
   - Handles GET/PUT requests for the global setting

3. **Pricing Algorithm Update**
   - `src/features/pricing-engine/services/pricingAlgorithm.ts`
   - Checks global setting before processing products
   - **IMPORTANT**: This is server-side only, not exported in feature's public API

4. **Smart Pricing Provider**
   - `src/features/pricing-engine/hooks/useSmartPricing.tsx`
   - Syncs with database instead of localStorage
   - Provides `isLoadingGlobal` state
   - `setGlobalEnabled` is now async and updates DB

5. **Feature Export**
   - `src/features/pricing-engine/index.ts`
   - Exports SmartPricingProvider and useSmartPricing (client-safe only)
   - Does NOT export pricingAlgorithm (server-side only)

6. **App Layout**
   - `src/app/(app)/layout.tsx`
   - Wraps app with SmartPricingProvider

7. **Products Page**
   - `src/app/(app)/products/page.tsx`
   - Adds global toggle button to page header
   - Integrates useSmartPricing hook

8. **Server-Side Imports Updated**
   - `src/trigger/daily-pricing.ts`
   - `src/app/api/pricing/run/route.ts`
   - Import pricingAlgorithm directly from services file

## Usage

### For End Users:
1. Navigate to the Products page
2. Look for the "Smart Pricing" toggle in the page header
3. Click the switch to enable/disable smart pricing globally
4. A toast notification will confirm the action

### For Developers:

#### Client Components:
```typescript
import { useSmartPricing } from '@/features/pricing-engine';

function MyComponent() {
  const { 
    globalEnabled,        // Current global state (boolean)
    setGlobalEnabled,     // Update global state (async function)
    isLoadingGlobal,      // Loading state (boolean)
    isProductEnabled      // Check if specific product is enabled
  } = useSmartPricing();

  // Toggle global pricing
  await setGlobalEnabled(false);

  // Check if product pricing is active
  const isActive = isProductEnabled('product-id'); // Returns false if global is off
}
```

#### Server Components / API Routes:
```typescript
// IMPORTANT: Import directly from service file, not from barrel export
import { runPricingAlgorithm } from '@/features/pricing-engine/services/pricingAlgorithm';

export async function POST() {
  const result = await runPricingAlgorithm();
  // ... handle result
}
```

> **Architecture Note**: The `pricingAlgorithm` service is intentionally NOT exported from the feature's public API (`index.ts`) because it uses `supabaseAdmin` which requires server-only environment variables. This prevents client-side hydration errors. Always import it directly when needed in API routes or server-side code.

## How It Works

### State Management Flow:
1. **Initial Load**: SmartPricingProvider fetches global setting from database
2. **User Toggle**: User clicks switch on Products page
3. **API Call**: PUT request to `/api/settings/global-pricing`
4. **Database Update**: Setting stored in `global_settings` table
5. **Local State Update**: React state updated to reflect change
6. **Toast Notification**: User sees confirmation message

### Algorithm Integration:
1. **Trigger Runs**: Daily pricing task executes (via Trigger.dev)
2. **Global Check**: Algorithm queries `global_settings` table
3. **Exit Early**: If disabled, algorithm skips all processing
4. **Log Run**: Algorithm logs the reason for skipping

## Testing

### Test the Toggle:
1. Open Products page
2. Toggle smart pricing OFF
3. Verify toast notification appears
4. Check database:
   ```sql
   SELECT value FROM global_settings 
   WHERE key = 'smart_pricing_global_enabled';
   ```
5. Toggle back ON and verify

### Test Algorithm Integration:
1. Disable smart pricing via toggle
2. Manually trigger pricing algorithm (or wait for scheduled run)
3. Check algorithm_runs table for "Global smart pricing is disabled" message

## Notes

- The global setting is stored in JSONB format for flexibility
- Individual product settings are preserved when global is toggled
- The switch is disabled while loading to prevent race conditions
- Toast notifications use Sonner for consistent UX
- The toggle respects the feature-based architecture rules

## Troubleshooting

### Toggle not working:
- Check browser console for API errors
- Verify Supabase connection is working
- Ensure migration was run successfully

### Algorithm still running when disabled:
- Check the global_settings table value
- Verify the algorithm is reading from the correct database
- Check algorithm_runs table for error messages

### State not persisting:
- Verify API endpoint is accessible
- Check network tab for PUT request
- Ensure database permissions are correct

