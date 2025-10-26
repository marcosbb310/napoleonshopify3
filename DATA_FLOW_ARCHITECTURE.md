# Smart Pricing App - Data Flow & Architecture

## 🎯 Complete Implementation Status

✅ **FULLY IMPLEMENTED** - All data flows, analytics, and user experience features are now complete and production-ready.

## 📊 Real-Time Data Flows

### 1. Sales Data Collection Flow
```
Shopify Order → Webhook → processSalesData → sales_data table → Analytics Engine
```

### 2. Analytics Calculation Flow
```
sales_data → AnalyticsEngine.calculateProductAnalytics → product_analytics table → API → Frontend
```

### 3. Pricing Decision Flow
```
Trigger.dev Job → runPricingAlgorithm → Update Shopify → pricing_history → analyzePriceChangeImpact
```

### 4. Real-time Updates Flow
```
React Query (5min polling) → API Routes → Supabase → Frontend
```

## 🗄️ Database Schema

### Core Tables
- `products` - Product catalog with pricing data
- `pricing_config` - Smart pricing configuration
- `pricing_history` - Price change tracking
- `sales_data` - Daily sales metrics
- `algorithm_runs` - Pricing algorithm execution logs

### Analytics Tables
- `product_analytics` - Aggregated product performance metrics
- `price_change_impact` - Price change effectiveness analysis
- `webhook_logs` - Webhook delivery and processing logs
- `error_logs` - Application error tracking
- `audit_logs` - Security and action auditing

### Performance Views
- `mv_product_performance` - Materialized view for fast analytics queries

## 🔄 Background Jobs

### Daily Analytics Refresh (2 AM UTC)
- Calculates performance scores for all products
- Updates revenue trends and profit margins
- Refreshes materialized views

### Hourly Sales Sync (Every hour)
- Syncs recent orders from Shopify
- Processes sales data in real-time
- Updates analytics metrics

### Daily Pricing Optimization (3 AM UTC)
- Runs pricing algorithm on eligible products
- Updates prices in Shopify
- Analyzes price change impact

## 🚀 API Endpoints

### Analytics APIs
- `GET /api/analytics/store-metrics` - Store-level metrics
- `GET /api/analytics/products/[id]` - Product-specific analytics
- `GET /api/analytics/top-performers` - Top performing products

### Webhook APIs
- `POST /api/webhooks/shopify/orders-create` - Order processing
- `POST /api/webhooks/shopify/products-update` - Product updates

## 🎨 Frontend Architecture

### React Query Integration
- Automatic caching and background updates
- Optimistic updates for better UX
- Request deduplication
- Global error handling

### Feature-Based Organization
- `analytics-dashboard/` - Analytics features
- `pricing-engine/` - Pricing algorithms
- `shopify-integration/` - Shopify API integration
- `auth/` - Authentication and user management

## 🔒 Security Features

### Input Validation
- Zod schema validation for all API inputs
- UUID format validation for IDs
- Date range validation

### Rate Limiting
- 60 requests per minute per user
- Automatic blocking of excessive requests

### Webhook Security
- HMAC signature verification
- Timing-safe comparison
- Request logging and monitoring

## 📈 Performance Optimizations

### Database
- Materialized views for fast analytics
- Proper indexing on all query patterns
- Connection pooling

### Frontend
- Code splitting for heavy components
- Prefetching of common data
- Request deduplication
- Optimistic updates

### Caching
- React Query with 5-minute stale time
- 10-minute garbage collection
- Background refetching

## 🧪 Testing Strategy

### Unit Tests
- Service layer functions
- Utility functions
- Validation schemas

### Integration Tests
- API endpoint testing
- Webhook verification
- Database operations

### Manual Testing
- Complete user flow testing
- Performance validation
- Security testing

## 📚 Documentation

### API Documentation
- Complete endpoint reference
- Request/response examples
- Error handling guide

### Deployment Guide
- Environment setup
- Database migrations
- Service configuration

### Testing Checklist
- Comprehensive test coverage
- Performance benchmarks
- Security validation

## 🏗️ Service Overview

```
┌─────────────────┐
│   Your App      │
│  (Next.js 15)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│Shopify │ │ Supabase │
│  API   │ │ Database │
└────────┘ └──────────┘
    ▲         ▲
    │         │
    └────┬────┘
         │
    ┌────▼────┐
    │Trigger  │
    │  .dev   │
    └─────────┘
```

## 📊 Data Flow Scenarios

### 1️⃣ **Initial Setup: Sync Products from Shopify → Supabase**

```
User clicks "Sync Products"
         ↓
┌─────────────────────────────────────────────────┐
│ Frontend: /products page                        │
│ Button → POST /api/shopify/sync                 │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Backend API: /api/shopify/sync/route.ts         │
│ - Calls syncProducts() service                  │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Service: syncProducts.ts                        │
│ 1. GET https://shop.myshopify.com/products.json│
│ 2. Transform Shopify format → App format       │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Supabase: Insert/Update products table          │
│ - Creates products records                      │
│ - Creates pricing_config records (autopilot on) │
└─────────────────────────────────────────────────┘
```

**Files Involved:**
- `src/app/api/shopify/sync/route.ts` - API endpoint
- `src/features/shopify-integration/services/syncProducts.ts` - Shopify API logic
- `src/shared/lib/supabase.ts` - Supabase client

**Environment Variables Used:**
```bash
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

### 2️⃣ **User Turns ON Smart Pricing Globally**

```
User toggles "Smart Pricing" ON
         ↓
┌─────────────────────────────────────────────────┐
│ Frontend: Header component                      │
│ useSmartPricing().handleGlobalToggle(false)     │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Modal appears: "Start from base or last price?" │
│ User selects option (base/last)                 │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ API Call: POST /api/pricing/global-resume      │
│ Body: { resumeOption: "base" or "last" }       │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Backend: /api/pricing/global-resume/route.ts   │
│ For each product:                               │
│ 1. Set price based on option                   │
│ 2. Enable auto_pricing_enabled = true          │
│ 3. Set next_price_change_date = NOW()          │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Supabase: Update products & pricing_config      │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Shopify: Update prices via Admin API           │
│ PUT /admin/api/2024-10/variants/{id}.json      │
└─────────────────────────────────────────────────┘
```

**Files Involved:**
- `src/features/pricing-engine/hooks/useSmartPricing.tsx` - State management
- `src/features/pricing-engine/components/SmartPricingResumeModal.tsx` - UI
- `src/app/api/pricing/global-resume/route.ts` - API endpoint

---

### 3️⃣ **Automatic Pricing (Trigger.dev Scheduled)**

```
⏰ Every day at 2 AM UTC (Trigger.dev schedule)
         ↓
┌─────────────────────────────────────────────────┐
│ Trigger.dev Cloud: Triggers scheduled task      │
│ Task: "daily-pricing" (src/trigger/daily-pricing.ts)
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Your App: Trigger.dev invokes task function    │
│ runs() { runPricingAlgorithm() }               │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Algorithm: pricingAlgorithm.ts                  │
│ 1. Query Supabase for products ready to change │
│    WHERE auto_pricing_enabled = true           │
│    AND next_price_change_date <= NOW()         │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ For Each Product:                               │
│ 1. Get sales data from Supabase                │
│ 2. Calculate revenue comparison                │
│ 3. Decide: increase or revert                  │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ If INCREASE:                                    │
│ - Calculate new_price = current * 1.05 (5%)    │
│ - Update Shopify variant price                 │
│ - Update Supabase products.current_price       │
│ - Insert into pricing_history                  │
│ - Set next_price_change_date = +24 hours       │
└─────────────────────────────────────────────────┘
         OR
         ↓
┌─────────────────────────────────────────────────┐
│ If REVERT (revenue dropped):                    │
│ - Revert to previous price                     │
│ - Update Shopify variant price                 │
│ - Update Supabase products.current_price       │
│ - Insert into pricing_history (action=revert)  │
│ - Set waiting period (24 hours)                │
└─────────────────────────────────────────────────┘
```

**Files Involved:**
- `src/trigger/daily-pricing.ts` - Trigger.dev task definition
- `src/features/pricing-engine/services/pricingAlgorithm.ts` - Core algorithm
- `trigger.config.ts` - Trigger.dev configuration

**Environment Variables:**
```bash
TRIGGER_SECRET_KEY=tr_dev_xxxxx  # For Trigger.dev authentication
```

---

### 4️⃣ **Manual Price Change (User → Shopify → Webhook → Supabase)**

```
User changes price manually in Shopify Admin
         ↓
┌─────────────────────────────────────────────────┐
│ Shopify: Product updated                        │
│ Triggers webhook to your app                   │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Your App: POST /api/webhooks/shopify/route.ts  │
│ 1. Verify HMAC signature (security)            │
│ 2. Extract new price from payload              │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ Supabase: Update pricing_config                │
│ - Reset next_price_change_date to NOW()        │
│ - Reset algorithm cycle (starts fresh)         │
└─────────────────────────────────────────────────┘
```

**Files Involved:**
- `src/app/api/webhooks/shopify/route.ts` - Webhook receiver
- Must configure webhook URL in Shopify Admin Settings

**Environment Variables:**
```bash
SHOPIFY_WEBHOOK_SECRET=xxxxx  # From Shopify webhook settings
```

---

## 🔄 Complete Data Flow Summary

### **Data Sources:**

1. **Shopify** (Source of Truth for Products)
   - Products & variants
   - Current prices
   - Inventory
   - Orders (for sales data)

2. **Supabase** (Your Database)
   - products (synced from Shopify)
   - pricing_config (algorithm settings)
   - pricing_history (audit log)
   - sales_data (revenue tracking)
   - global_settings (feature toggles)

3. **Trigger.dev** (Automation)
   - Scheduled tasks (daily at 2 AM)
   - Retry logic (3 attempts)
   - Monitoring dashboard

### **Data Flow Direction:**

```
Shopify → Supabase (Sync)
    ↓
Supabase → Algorithm (Read)
    ↓
Algorithm → Calculation (Process)
    ↓
Calculation → Supabase (Write)
    ↓
Supabase → Shopify (Update Prices)
```

---

## 🔌 How Each Service Connects

### **1. Supabase Connection**

**File:** `src/shared/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

// Client for frontend (read-only)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client for backend (full access)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

**Used in:**
- All API routes (backend)
- All feature services
- Algorithm logic

---

### **2. Shopify Connection**

**File:** `src/features/shopify-integration/services/syncProducts.ts`

```typescript
// Direct REST API calls
const response = await fetch(
  `https://${SHOPIFY_STORE_URL}/admin/api/2024-10/products.json`,
  {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
    }
  }
);
```

**Used in:**
- Product sync (`/api/shopify/sync`)
- Order sync (`/api/shopify/sync-orders`)
- Price updates (in pricingAlgorithm.ts)

---

### **3. Trigger.dev Connection**

**File:** `src/trigger/daily-pricing.ts`

```typescript
import { schedules } from '@trigger.dev/sdk/v3';

export const dailyPricing = schedules.task({
  id: 'daily-pricing-algorithm',
  cron: '0 2 * * *',  // 2 AM UTC daily
  run: async () => {
    await runPricingAlgorithm();
  }
});
```

**Configuration:** `trigger.config.ts`

```typescript
export default {
  project: 'napoleonshopify3',
  runtime: 'node',
  dirs: ['./src/trigger']
};
```

**Commands:**
- `npm run trigger:dev` - Local testing
- `npm run trigger:deploy` - Deploy to cloud

---

## 📋 Order of Operations (Typical Day)

### **Morning (2:00 AM UTC)**
```
1. Trigger.dev wakes up
2. Runs daily-pricing task
3. Algorithm checks all products
4. Updates prices for products ready to change
5. Logs everything to Supabase
6. Updates Shopify prices
7. Sets next_price_change_date for each product
```

### **During the Day**
```
1. User views products page
   → Frontend fetches from Supabase (fast)
   
2. User syncs new products
   → API fetches from Shopify
   → Saves to Supabase
   
3. User toggles smart pricing
   → Updates Supabase settings
   → Updates Shopify prices immediately
   
4. Shopify sends webhook (manual change)
   → Your app receives webhook
   → Updates Supabase
   → Resets pricing cycle
```

---

## 🔑 Key Takeaways

1. **Supabase is the center** - All data flows through it
2. **Shopify is synced** - Not queried in real-time (too slow)
3. **Trigger.dev is the scheduler** - Runs algorithm automatically
4. **Algorithm is stateless** - Only uses data in Supabase
5. **Webhooks keep it in sync** - Manual changes are detected

---

## 🛠️ Environment Variables Needed

```bash
# Supabase (Database)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Shopify (E-commerce Platform)
NEXT_PUBLIC_SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
NEXT_PUBLIC_SHOPIFY_API_VERSION=2024-10

# Trigger.dev (Task Scheduler)
TRIGGER_SECRET_KEY=tr_dev_xxxxx

# Shopify Webhooks (Optional, for manual change detection)
SHOPIFY_WEBHOOK_SECRET=xxxxx
```

---

## 🚀 Quick Reference

| What | Where | Why |
|------|-------|-----|
| Product data | Supabase `products` | Fast queries, local control |
| Pricing rules | Supabase `pricing_config` | Per-product settings |
| Price history | Supabase `pricing_history` | Audit trail |
| Sales data | Supabase `sales_data` | Revenue calculations |
| Actual prices | Shopify | Source of truth for customers |
| Scheduled runs | Trigger.dev | Automatic daily execution |
| Manual changes | Webhooks | Keep Supabase in sync |


