interface RequiredEnvVars {
  // Shopify OAuth
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_WEBHOOK_SECRET: string;
  
  // App Configuration
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_SHOPIFY_API_VERSION: string;
  
  // Database
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  
  // Encryption
  ENCRYPTION_KEY: string;
}

const requiredEnvVars: (keyof RequiredEnvVars)[] = [
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'SHOPIFY_WEBHOOK_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SHOPIFY_API_VERSION',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENCRYPTION_KEY',
];

export function validateEnvironment(): void {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    
    if (!value) {
      missing.push(envVar);
      continue;
    }

    // Specific validations
    switch (envVar) {
      case 'NEXT_PUBLIC_APP_URL':
        if (!value.startsWith('http')) {
          invalid.push(`${envVar} must be a valid URL (got: ${value})`);
        }
        break;
      case 'NEXT_PUBLIC_SHOPIFY_API_VERSION':
        if (!/^\d{4}-\d{2}$/.test(value)) {
          invalid.push(`${envVar} must be in format YYYY-MM (got: ${value})`);
        }
        break;
      case 'ENCRYPTION_KEY':
        if (value.length < 32) {
          invalid.push(`${envVar} must be at least 32 characters`);
        }
        break;
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    const errors = [
      ...missing.map(v => `Missing: ${v}`),
      ...invalid
    ];
    
    console.error('❌ Environment validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    
    throw new Error(`Environment validation failed: ${errors.join(', ')}`);
  }

  console.log('✅ Environment validation passed');
}

// Auto-validate on import in production
if (process.env.NODE_ENV === 'production') {
  validateEnvironment();
}
