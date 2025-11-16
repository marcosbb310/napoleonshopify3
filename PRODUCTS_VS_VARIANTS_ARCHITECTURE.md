# Products vs Variants Architecture

## Current Architecture

You have **2 separate tables** for a good reason:

### 1. `products` Table (Parent/Grouping)
**Purpose**: Product-level metadata and grouping

**Contains**:
- `id` (UUID) - Primary key
- `shopify_id` (TEXT) - Shopify product ID
- `title` - Product name
- `vendor` - Brand/manufacturer
- `product_type` - Category
- `description` - Product description
- `handle` - URL slug
- `tags` - Product tags
- `status` - active/draft/archived
- `store_id` - Which store owns it

**Think of it as**: The "parent" that groups related variants together

### 2. `product_variants` Table (Children/Priced Items)
**Purpose**: Individual priced items with their own pricing data

**Contains**:
- `id` (UUID) - Primary key
- `product_id` (UUID FK) - Links to `products.id`
- `shopify_id` (TEXT) - Shopify variant ID
- `shopify_product_id` (TEXT) - Shopify product ID (parent)
- `title` - Variant name (e.g., "Large / Blue")
- `price` - Original price
- `current_price` - Current price (can change)
- `starting_price` - Starting price for smart pricing
- `sku` - Stock keeping unit
- `inventory_quantity` - Stock count
- `weight` - Shipping weight
- `store_id` - Which store owns it

**Think of it as**: The "children" - actual priced items that get sold

### 3. `pricing_config` Table (Per Variant)
**Purpose**: Smart pricing configuration per variant

**Contains**:
- `id` (UUID)
- `variant_id` (UUID FK, UNIQUE) - **One config per variant**
- `product_id` (UUID FK) - Also links to product (for convenience)
- `auto_pricing_enabled` - Whether smart pricing is on
- `increment_percentage` - How much to increase
- `current_state` - increasing/waiting_after_revert/at_max_cap
- `pre_smart_pricing_price` - Price before smart pricing
- `last_smart_pricing_price` - Last price set by algorithm
- `next_price_change_date` - When to change next

**Key**: `variant_id` is UNIQUE, so **each variant has its own pricing config**

## How It Works

### Example: T-Shirt Product

**In Shopify**:
```
Product: "Basic T-Shirt"
├── Variant 1: Small / Red - $20
├── Variant 2: Medium / Red - $20
├── Variant 3: Large / Red - $22
└── Variant 4: Large / Blue - $22
```

**In Your Database**:

**`products` table** (1 row):
```sql
id: uuid-123
shopify_id: "1234567890"
title: "Basic T-Shirt"
vendor: "Brand Name"
product_type: "Apparel"
```

**`product_variants` table** (4 rows):
```sql
Row 1: id=uuid-a, product_id=uuid-123, shopify_id="v1", title="Small / Red", current_price=20.00
Row 2: id=uuid-b, product_id=uuid-123, shopify_id="v2", title="Medium / Red", current_price=20.00
Row 3: id=uuid-c, product_id=uuid-123, shopify_id="v3", title="Large / Red", current_price=22.00
Row 4: id=uuid-d, product_id=uuid-123, shopify_id="v4", title="Large / Blue", current_price=22.00
```

**`pricing_config` table** (4 rows - one per variant):
```sql
Row 1: variant_id=uuid-a, auto_pricing_enabled=true, current_state='increasing'
Row 2: variant_id=uuid-b, auto_pricing_enabled=true, current_state='increasing'
Row 3: variant_id=uuid-c, auto_pricing_enabled=true, current_state='waiting_after_revert'
Row 4: variant_id=uuid-d, auto_pricing_enabled=false  ← Disabled for this variant
```

### Smart Pricing Algorithm

The algorithm processes **variants**, not products:

```typescript
// From pricingAlgorithm.ts
// Get all variants
const { data: allVariants } = await supabaseAdmin
  .from('product_variants')
  .select('*, pricing_config(*)')
  .eq('store_id', storeId);

// Process EACH variant individually
for (const { variant, config } of variantsToProcess) {
  await processVariant(variant, config, ...);
  // Each variant gets its own price change decision
}
```

**Result**: Each variant can have different:
- Prices (Large might increase, Small might stay same)
- Pricing states (one might be increasing, another waiting)
- Enable/disable status (one variant disabled, others enabled)

## Why Two Tables?

### ✅ Benefits of Separate Tables

1. **Proper Normalization**
   - Products = metadata (stored once)
   - Variants = data that changes (stored separately)
   - Avoids duplication (title, vendor, description stored once, not per variant)

2. **Individual Pricing Control**
   - Each variant can have its own price
   - Each variant can be enabled/disabled separately
   - Each variant can have different pricing strategies

3. **Flexibility**
   - Easy to add/remove variants without affecting product metadata
   - Can query products separately from variants
   - Can aggregate data (e.g., "all variants of this product")

4. **Matches Shopify Model**
   - Shopify also has products (parent) and variants (children)
   - Makes sync easier
   - Keeps data structure consistent

### ❌ If We Only Had One Table

**Problems**:
- Would duplicate product metadata for each variant
- Hard to group variants together
- Can't have different prices per variant (would need array column)
- Doesn't match Shopify's structure

**Example** (bad design):
```sql
-- BAD: Everything in one table
CREATE TABLE all_items (
  id UUID,
  product_title TEXT,  -- Duplicated: "Basic T-Shirt" × 4 rows
  vendor TEXT,         -- Duplicated: "Brand" × 4 rows
  variant_title TEXT,  -- "Small / Red", "Medium / Red", etc.
  price DECIMAL,
  ...
);
```

## How UI Works

### Toggling Smart Pricing

When you click "Enable Smart Pricing" on a product card:

1. **UI shows product** (for user convenience - easier to see "Basic T-Shirt" than 4 variant cards)
2. **API receives product ID** (Shopify ID)
3. **API finds all variants** of that product via `getVariantsByProductId()`
4. **API enables/disables smart pricing for ALL variants** of that product

```typescript
// From handleSmartPricingToggle in config/[productId]/route.ts
const variants = await getVariantsByProductId(productId, store.id);
// Returns all variants for this product

// Then enables/disables pricing for EACH variant
for (const variant of variants) {
  await disableVariantSmartPricing(variant.id, ...);
  // OR
  await resumeVariantSmartPricing(variant.id, ...);
}
```

**So**: You toggle at the **product level** (user-friendly), but it affects **all variants** (logical grouping).

## Summary

### Are we treating each product as a variant?
**No!** Products are **parents**, variants are **children**.

### Are we treating each variant as a product?
**No!** Variants are **grouped under products**. Products provide metadata, variants are the actual priced items.

### The Rationale

**Two tables because**:
1. ✅ Products = grouping/metadata (stored once)
2. ✅ Variants = individual priced items (stored separately)
3. ✅ Each variant needs its own price, pricing config, and pricing state
4. ✅ Matches Shopify's model
5. ✅ Proper database normalization

**Smart pricing works on variants** because:
- Each variant has its own price
- Each variant can have different pricing behavior
- Algorithm processes variants individually

**UI shows products** because:
- Users think in terms of products (easier to understand)
- One toggle affects all variants (logical grouping)
- But underlying system still processes variants individually

## Diagram

```
Shopify Product: "Basic T-Shirt"
│
├─ products table (1 row)
│  └─ Metadata: title, vendor, description
│
└─ product_variants table (4 rows)
   ├─ Variant 1: Small/Red - $20 - pricing_config: enabled
   ├─ Variant 2: Medium/Red - $20 - pricing_config: enabled
   ├─ Variant 3: Large/Red - $22 - pricing_config: waiting
   └─ Variant 4: Large/Blue - $22 - pricing_config: disabled

Smart Pricing Algorithm:
  ↓
Processes each variant individually
  ↓
Variant 1: Increase to $21 ✅
Variant 2: Increase to $21 ✅
Variant 3: Wait (recently reverted) ⏸️
Variant 4: Skip (disabled) ❌
```

This architecture makes perfect sense! 🎯

