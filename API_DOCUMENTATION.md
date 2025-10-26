# API Documentation

## Analytics Endpoints

### GET /api/analytics/store-metrics
Get aggregated metrics for a store.

**Query Parameters:**
- `storeId` (required): UUID of the store
- `from` (optional): ISO date string
- `to` (optional): ISO date string

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 12450,
    "totalProfit": 3720,
    "optimizedProducts": 47,
    "priceChangesToday": 12
  }
}
```

### GET /api/analytics/products/[productId]
Get detailed analytics for a specific product.

**Response:**
```json
{
  "success": true,
  "data": {
    "analytics": {
      "performance_score": 87,
      "revenue_trend": "increasing",
      "profit_margin": 45.2
    },
    "salesData": [...],
    "priceHistory": [...]
  }
}
```

### GET /api/analytics/top-performers
Get top performing products for a store.

**Query Parameters:**
- `storeId` (required): UUID of the store
- `limit` (optional): Number of products to return (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "product_id": "uuid",
      "title": "Product Name",
      "performance_score": 94,
      "revenue_30d": 80091.10
    }
  ]
}
```

## Webhook Endpoints

### POST /api/webhooks/shopify/orders-create
Receives order creation webhooks from Shopify.

**Headers:**
- `x-shopify-hmac-sha256`: HMAC signature
- `x-shopify-shop-domain`: Shop domain

### POST /api/webhooks/shopify/products-update
Receives product update webhooks from Shopify.

**Headers:**
- `x-shopify-hmac-sha256`: HMAC signature
- `x-shopify-shop-domain`: Shop domain

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "success": false
}
```

Common status codes:
- 200: Success
- 400: Bad Request (invalid parameters)
- 401: Unauthorized (missing/invalid auth)
- 404: Not Found
- 500: Internal Server Error
