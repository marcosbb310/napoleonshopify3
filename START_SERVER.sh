#!/bin/bash
# Script to start the dev server with proper Node.js configuration

cd /Users/marcosbb310/Desktop/code/napoleonshopify3/napoleonshopify3

# Kill any existing Next.js dev servers
echo "🧹 Cleaning up old processes..."
pkill -f "next dev" 2>/dev/null
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null
sleep 1

# Clear Next.js cache
echo "🗑️  Clearing .next cache..."
rm -rf .next

# Start server with Node.js fix for v24
echo "🚀 Starting dev server..."
# Disable network interface detection to avoid macOS permission issues
HOSTNAME=localhost NODE_OPTIONS='--dns-result-order=ipv4first' npm run dev

