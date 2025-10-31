#!/usr/bin/env node

/**
 * Quick script to check what URL your OAuth is actually using
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, 'napoleonshopify3', '.env.local');

console.log('🔍 Checking OAuth Configuration...\n');

// Read .env.local
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local not found at:', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const BASE_URL = process.env.SHOPIFY_APP_URL || envVars.NEXT_PUBLIC_APP_URL || envVars.SHOPIFY_APP_URL;
const redirectUri = BASE_URL ? `${BASE_URL}/api/auth/shopify/v2/callback` : 'NOT SET';

console.log('📋 Current Configuration:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`SHOPIFY_APP_URL:        ${process.env.SHOPIFY_APP_URL || envVars.SHOPIFY_APP_URL || 'NOT SET'}`);
console.log(`NEXT_PUBLIC_APP_URL:    ${envVars.NEXT_PUBLIC_APP_URL || 'NOT SET'}`);
console.log(`BASE_URL (used):        ${BASE_URL || 'NOT SET'}`);
console.log(`Redirect URI (built):    ${redirectUri}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (!BASE_URL) {
  console.error('❌ ERROR: No BASE_URL found!');
  console.error('   Set NEXT_PUBLIC_APP_URL in .env.local');
  process.exit(1);
}

// Parse URL to show components
try {
  const url = new URL(BASE_URL);
  console.log('🔍 URL Breakdown:');
  console.log(`   Protocol: ${url.protocol}`);
  console.log(`   Host:      ${url.host}`);
  console.log(`   Port:      ${url.port || '(default)'}`);
  console.log(`   Full URL:  ${BASE_URL}\n`);
} catch (e) {
  console.error('❌ Invalid URL format:', BASE_URL);
  process.exit(1);
}

console.log('✅ Required Partner Dashboard Settings:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('App URL:');
console.log(`   ${BASE_URL}\n`);
console.log('Allowed redirection URL(s):');
console.log(`   ${redirectUri}\n`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📝 Next Steps:');
console.log('1. Go to: https://partners.shopify.com/');
console.log('2. Navigate to: Apps → Napoleon3 → Configuration');
console.log('3. Set App URL to:', BASE_URL);
console.log('4. Add to Allowed redirection URLs:', redirectUri);
console.log('5. Save and try OAuth again!\n');

