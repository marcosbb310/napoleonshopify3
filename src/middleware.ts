import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from './shared/lib/supabase'

export async function middleware(request: NextRequest) {
  try {
    const { supabase, response } = createMiddlewareClient(request)

    // Refresh session if exists
    await supabase.auth.getSession()

    // Protected routes (require authentication)
    const protectedPaths = ['/dashboard', '/products', '/pricing', '/analytics', '/settings']
    const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

    if (isProtectedPath) {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Redirect to home page if not authenticated
        const redirectUrl = new URL('/', request.url)
        redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
        return NextResponse.redirect(redirectUrl)
      }
    }

    // IMPORTANT: Don't set X-Frame-Options: DENY for OAuth callback routes
    // OAuth callbacks need to open in popups, which DENY would block
    const isOAuthCallback = request.nextUrl.pathname.startsWith('/api/auth/shopify/v2/callback')
    
    // Add security headers to all responses (except OAuth callback)
    if (!isOAuthCallback) {
      response.headers.set('X-Frame-Options', 'DENY')
    } else {
      // Allow OAuth callback to be opened in popup
      response.headers.set('X-Frame-Options', 'SAMEORIGIN')
    }
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('X-XSS-Protection', '1; mode=block')

    return response
  } catch (error) {
    // If middleware fails, just continue without authentication checks
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match only page routes, not API routes or static files
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}

