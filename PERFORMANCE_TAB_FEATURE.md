# Performance Tab Feature - Product Analytics Modal

## Overview
Added a comprehensive **Performance** tab to the product analytics modal in the products-test page. This tab demonstrates the effectiveness of smart pricing by showing revenue, sales volumes, and the impact of each price change.

## Location
**File:** `src/app/(app)/products-test/page.tsx`
**Modal:** Right-side analytics sheet that opens when clicking "View Analytics" on product cards
**Tab Order:** Analytics → **Performance** → Settings → History

## Features

### 1. Smart Pricing Impact (Hero Section)
Large, prominent display showing:
- **Revenue Increase %** - Percentage increase vs baseline (if price stayed at base)
- **Total Revenue** - Actual revenue generated
- **Revenue Dollar Amount** - Exact dollar increase vs baseline
- **Total Units Sold** - Number of units sold

Visual: Green gradient card with TrendingUp icon to emphasize positive impact

### 2. Summary Statistics
Three key metrics in a grid:
- **Average Sale Price** - Average price across all sales
- **Price Changes** - Total number of price adjustments made
- **Base Price** - Starting price reference

### 3. Performance by Price Point
Detailed breakdown of each price change showing:

#### For Each Price Change:
- **Price Transition** - Old price → New price with percentage change
- **Date & Time** - When the change occurred
- **Action Type** - Badge showing action (increase, revert, manual)
- **Revenue After Change** - Total revenue generated at this price
- **Revenue Change %** - Percentage change from previous period (color-coded)
- **Units Sold** - Number of units sold at this price
- **Price Per Unit** - Average price per unit
- **Reason** - Explanation for the price change

Visual: Each price change is a card with metrics and color-coded badges

### 4. Baseline Comparison
Side-by-side comparison showing:
- **With Smart Pricing** - Actual revenue (highlighted in green)
- **At Base Price Only** - What revenue would have been without smart pricing

This makes it crystal clear that smart pricing is working and generating more revenue.

## Data Source

### API Endpoint
**File:** `src/app/api/products/[productId]/performance/route.ts`

**Route:** `GET /api/products/[productId]/performance`

### Database Tables Used:
1. **products** - Product info, base price, current price
2. **pricing_config** - Smart pricing settings
3. **pricing_history** - All price changes with reasons
4. **sales_data** - Daily sales data (last 90 days)

### Calculations:
- **Total Revenue**: Sum of all sales revenue
- **Baseline Revenue**: Units sold × base price (what would have happened)
- **Revenue Increase**: Actual revenue - baseline revenue
- **Revenue Increase %**: (Revenue increase / baseline) × 100
- **Performance per Price**: Groups sales by price change periods

## User Experience

### Loading States
- Shows spinner while fetching performance data
- "Loading performance data..." message

### Empty States
1. **No Price Changes**: Shows package icon with message "No price changes yet"
2. **No Data Available**: Shows alert icon with "No performance data available"

### Data Fetching
- Data fetches automatically when modal opens
- Uses productId (Shopify ID) to fetch specific product performance
- Handles errors gracefully

## Visual Design

### Color Coding:
- **Green**: Positive metrics, revenue increases, smart pricing benefits
- **Blue**: Price increases
- **Red/Yellow**: Price decreases or negative changes
- **Muted**: Baseline/comparison metrics

### Layout:
- Hero section at top (most important metric)
- Summary stats in grid
- Detailed price history in scrollable list
- Baseline comparison at bottom for context

## Key Benefits Highlighted

The Performance tab makes it **very clear** that smart pricing is working by:

1. ✅ **Direct Revenue Comparison** - Shows exact dollar and percentage increase
2. ✅ **Visual Impact** - Green highlighting on positive metrics
3. ✅ **Detailed Breakdown** - Every price change with its results
4. ✅ **Baseline Context** - "What if" scenario showing alternative
5. ✅ **Revenue Trends** - Shows if each price change increased or decreased revenue
6. ✅ **Volume Impact** - Shows how price changes affected sales volume

## Example Data Displayed

For a product with smart pricing enabled:
```
Smart Pricing Impact
+18.3%                    $4,520.00
$4,520.00 vs baseline    125 units sold

Performance by Price Point:
$49.99 → $54.99 (↑ 10.0%)
Jan 15, 2025 2:30 PM
Revenue: $2,475.00  (↑ 15.2% from previous)
Units: 45           ($55.00/unit)
Reason: Low price elasticity detected, testing higher price point
```

## Technical Implementation

### State Management:
```typescript
const [performanceData, setPerformanceData] = useState<any>(null);
const [loadingPerformance, setLoadingPerformance] = useState(false);
```

### Data Fetching:
```typescript
const fetchPerformanceData = async (productId: string) => {
  // Fetches from /api/products/[productId]/performance
  // Sets performanceData state
}
```

### Integration:
- Fetches when modal opens via `handleViewAnalytics()`
- Uses existing product ID from card click
- Displays in new Performance tab between Analytics and Settings

## Future Enhancements

Possible additions:
- Chart/graph visualization of price history
- Export performance report to PDF
- Compare multiple products' performance
- Filter by date range
- Show predicted revenue if price continues
- A/B test comparison for different pricing strategies

