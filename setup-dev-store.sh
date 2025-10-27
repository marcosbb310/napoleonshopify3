#!/bin/bash

echo "🚀 Shopify Dev Store Setup Script"
echo "=================================="

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local file..."
    cat > .env.local << 'EOF'
# Shopify App Configuration
SHOPIFY_API_KEY=eb49208f806430d7c4e39b914be9a18a
SHOPIFY_API_SECRET=your_shopify_api_secret_here
SHOPIFY_SCOPES=read_products,write_products,read_orders,read_customers,write_customers

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SHOPIFY_API_VERSION=2024-10

# Supabase Configuration (get from your Supabase project)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Encryption key for storing tokens securely (generate a random 32-character string)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Optional: Shopify Webhook Secret
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here
EOF
    echo "✅ Created .env.local file"
else
    echo "⚠️  .env.local already exists"
fi

echo ""
echo "📋 Next Steps:"
echo "1. Go to https://partners.shopify.com and create a Partner account"
echo "2. Create a development store"
echo "3. Create an app in your Partner Dashboard"
echo "4. Copy your Client ID and Client Secret"
echo "5. Update the .env.local file with your credentials"
echo "6. Run: npm run dev"
echo ""
echo "📖 For detailed instructions, see: SHOPIFY_DEV_STORE_SETUP.md"
echo ""
echo "🔗 Quick Links:"
echo "   - Shopify Partners: https://partners.shopify.com"
echo "   - Your App: http://localhost:3000"
echo "   - Settings: http://localhost:3000/settings"
