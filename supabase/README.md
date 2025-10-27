# 🗄️ Supabase Database Schema

This folder contains the database schema for the Smart Pricing application.

## 📁 Files

### `migrations/001_initial_schema.sql`
**The master schema file** - Contains the complete database structure with all tables, indexes, and triggers.

**When to use:**
- Setting up a fresh database
- Reference for current schema
- Documentation for database structure

**Tables included:**
1. `products` - Shopify product data
2. `pricing_config` - Per-product pricing settings (uses **period_hours**)
3. `pricing_history` - Complete log of all price changes
4. `sales_data` - Daily sales and revenue tracking
5. `algorithm_runs` - Logs of pricing algorithm executions

## 🚀 Quick Start

### For Fresh Database Setup:
1. Go to Supabase Dashboard → SQL Editor
2. Copy entire contents of `migrations/001_initial_schema.sql`
3. Paste and click "Run"
4. Done! All 5 tables created with indexes and triggers

## ⚙️ Key Configuration

### Pricing Cycle
- **Field**: `pricing_config.period_hours`
- **Default**: 24 hours (1 day)
- **For testing**: Set to `1` for hourly price changes
- **For production**: Keep at `24` or higher (48 for every 2 days)

### Example: Set 1-hour cycle for testing
```sql
UPDATE pricing_config SET period_hours = 1;
```

## 📊 Database Structure

```
products
├── shopify_id (unique)
├── title
├── starting_price
└── current_price

pricing_config (links to products)
├── auto_pricing_enabled
├── increment_percentage (default: 5%)
├── period_hours (default: 48)
├── revenue_drop_threshold (default: 1%)
├── max_increase_percentage (default: 100%)
├── current_state (increasing/waiting/at_max_cap)
└── next_price_change_date

pricing_history
├── product_id
├── old_price → new_price
├── action (increase/revert/manual)
├── reason
└── revenue metrics

sales_data
├── product_id
├── date
├── price_on_date
├── units_sold
└── revenue

algorithm_runs
├── timestamp
├── products_processed
├── products_increased/reverted/waiting
└── errors (if any)
```

## 🔧 Common Operations

### Check pricing config
```sql
SELECT p.title, pc.period_hours, pc.next_price_change_date 
FROM products p
JOIN pricing_config pc ON p.id = pc.product_id;
```

### View pricing history
```sql
SELECT p.title, ph.old_price, ph.new_price, ph.action, ph.timestamp
FROM pricing_history ph
JOIN products p ON ph.product_id = p.id
ORDER BY ph.timestamp DESC
LIMIT 10;
```

### Check algorithm runs
```sql
SELECT * FROM algorithm_runs ORDER BY timestamp DESC LIMIT 5;
```

## 📝 Notes

- Row Level Security (RLS) is **disabled** for MVP
- Enable RLS before production deployment
- All timestamps use UTC timezone
- Prices stored as DECIMAL(10, 2) for precision

