#!/bin/bash

# Test Health Check Endpoint
# Usage: ./test-health-check.sh [base_url]

BASE_URL="${1:-http://localhost:3000}"
ENDPOINT="${BASE_URL}/api/system/health/products"

echo "🔍 Testing Health Check Endpoint..."
echo "URL: $ENDPOINT"
echo ""

# Make request
RESPONSE=$(curl -s -w "\n%{http_code}" "$ENDPOINT")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Parse and display results
if command -v jq &> /dev/null; then
  OK=$(echo "$BODY" | jq -r '.ok // false')
  NULL_IDS=$(echo "$BODY" | jq -r '.nullIds // 0')
  EMPTY_IDS=$(echo "$BODY" | jq -r '.emptyIds // 0')
  INVALID_IDS=$(echo "$BODY" | jq -r '.invalidStringIds // 0')
  ACTIVE_NULL=$(echo "$BODY" | jq -r '.activeNullIds // 0')
  TOTAL=$(echo "$BODY" | jq -r '.totalProducts // 0')
  
  echo "📊 Summary:"
  echo "  Status: $([ "$OK" = "true" ] && echo "✅ OK" || echo "❌ FAILED")"
  echo "  Total Products: $TOTAL"
  echo "  NULL shopify_id: $NULL_IDS"
  echo "  Empty shopify_id: $EMPTY_IDS"
  echo "  Invalid string IDs: $INVALID_IDS"
  echo "  Active with NULL: $ACTIVE_NULL"
  echo ""
  
  if [ "$OK" = "true" ]; then
    echo "✅ Health check passed - All shopify_id values are valid!"
  else
    echo "⚠️  Health check failed - Found invalid shopify_id values!"
    echo "   Review the counts above and check your database."
  fi
else
  echo "💡 Install 'jq' for better output formatting: brew install jq"
fi

