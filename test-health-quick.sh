#!/bin/bash
echo "Testing health check endpoint..."
curl -s http://localhost:3000/api/system/health/products | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/api/system/health/products
