// Coming Soon page
'use client';

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-2xl text-center space-y-8">
        <div>
          <h1 className="text-5xl font-bold tracking-tight">
            Smart Pricing for Shopify
          </h1>
          <p className="mt-4 text-xl text-muted-foreground">
            AI-powered dynamic pricing that maximizes your revenue automatically
          </p>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold text-primary">
            Coming Soon
          </h2>
          <p className="text-lg text-muted-foreground">
            We're putting the finishing touches on something amazing.
          </p>
          <p className="text-sm text-muted-foreground">
            Stay tuned for updates!
          </p>
        </div>
      </div>
    </div>
  );
}