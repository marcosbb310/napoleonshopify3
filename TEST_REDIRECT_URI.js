// Test script to see exactly what redirect_uri looks like when sent
const redirectUri = "http://localhost:3000/api/auth/shopify/v2/callback";
const oauthUrl = new URL(`https://test-store.myshopify.com/admin/oauth/authorize`);
oauthUrl.searchParams.set('redirect_uri', redirectUri);

console.log('1. Original redirectUri:', redirectUri);
console.log('2. As search param (get):', oauthUrl.searchParams.get('redirect_uri'));
console.log('3. Full OAuth URL:', oauthUrl.toString());
console.log('4. Extract redirect_uri from URL:', oauthUrl.toString().match(/redirect_uri=([^&]+)/)?.[1]);
console.log('5. Decoded:', decodeURIComponent(oauthUrl.toString().match(/redirect_uri=([^&]+)/)?.[1] || ''));

// Compare hosts
const redirectUrl = new URL(redirectUri);
const applicationUrl = "http://localhost:3000";
const appUrlObj = new URL(applicationUrl);

console.log('\nHost Comparison:');
console.log('redirect_uri host:', redirectUrl.host);
console.log('redirect_uri hostname:', redirectUrl.hostname);
console.log('redirect_uri port:', redirectUrl.port || 'default');
console.log('application_url host:', appUrlObj.host);
console.log('Hosts match?', redirectUrl.host === appUrlObj.host);

