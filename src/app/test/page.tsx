// Simple test page to bypass auth issues
'use client';

export default function TestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-2xl text-center space-y-8">
        <div>
          <h1 className="text-5xl font-bold tracking-tight">
            🚀 Test Page - No Auth
          </h1>
          <p className="mt-4 text-xl text-muted-foreground">
            This page loads without authentication to test if the issue is auth-related
          </p>
        </div>
        
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold text-primary">
            ✅ Page Loading Works!
          </h2>
          <p className="text-lg text-muted-foreground">
            If you can see this, the basic Next.js setup is working fine.
            The issue is likely in the authentication flow.
          </p>
          
          <div className="space-y-4">
            <a 
              href="/dashboard"
              className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Dashboard (with auth)
            </a>
            <p className="text-sm text-muted-foreground">
              This will test if the auth is causing the slow loading
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
