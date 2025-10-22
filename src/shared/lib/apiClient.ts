'use client'
import { useCurrentStore } from '@/features/auth'

export function createAuthenticatedFetch(storeId?: string) {
  return async (url: string, options: RequestInit = {}) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
    
    if (storeId) {
      headers['x-store-id'] = storeId
    }
    
    return fetch(url, {
      ...options,
      headers,
    })
  }
}

// Hook version for components
export function useAuthenticatedFetch() {
  const { currentStore } = useCurrentStore()
  
  return (url: string, options: RequestInit = {}) => {
    return createAuthenticatedFetch(currentStore?.id)(url, options)
  }
}

