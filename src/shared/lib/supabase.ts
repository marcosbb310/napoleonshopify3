import { createBrowserClient } from '@supabase/ssr'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Browser Client (Client Components)
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server Component Client
export async function createServerClient() {
  // Import cookies dynamically to avoid bundling issues
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  
  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })
}

// API Route Handler Client
export function createRouteHandlerClient(request: NextRequest) {
  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        request.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: Record<string, unknown>) {
        request.cookies.set({ name, value: '', ...options })
      },
    },
  })
}

// Middleware Client
export function createMiddlewareClient(request: NextRequest) {
  const response = NextResponse.next({ request })
  
  const supabase = createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: Record<string, unknown>) {
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })
  
  return { supabase, response }
}

// Admin Client (Server-Side Only)
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client can only be used on server')
  }
  
  return createSSRServerClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    cookies: {
      get() { return undefined },
    }
  })
}
