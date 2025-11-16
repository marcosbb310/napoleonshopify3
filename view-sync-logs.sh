#!/bin/bash
# Script to view sync logs in real-time

echo "🔍 Finding Next.js dev server process..."
PID=$(pgrep -f "next dev" | head -1)

if [ -z "$PID" ]; then
    echo "❌ No Next.js dev server found running"
    echo "💡 Start it with: npm run dev"
    exit 1
fi

echo "✅ Found Next.js process: PID $PID"
echo ""
echo "📋 To see server logs:"
echo "   1. The server is running but logs may not be visible"
echo "   2. Check browser console (F12) for client-side logs"
echo "   3. Or restart server in a visible terminal:"
echo "      cd /Users/marcosbb310/Desktop/code/napoleonshopify3"
echo "      npm run dev"
echo ""
echo "🔍 Current process info:"
ps -p $PID -o pid,command,etime

