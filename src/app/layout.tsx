import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, QueryProvider } from "@/shared/components";
import { Toaster } from "@/shared/components/ui/sonner";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
// Environment validation is handled in middleware and API routes
// No need to validate in layout as it can cause SSR issues

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Pricing for Shopify - Coming Soon",
  description: "AI-powered dynamic pricing for Shopify stores. Coming soon!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <ErrorBoundary>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              {children}
              <Toaster />
            </ThemeProvider>
          </ErrorBoundary>
        </QueryProvider>
      </body>
    </html>
  );
}
