'use client'
import { useCurrentStore } from '@/features/auth'

export function createAuthenticatedFetch(storeId?: string) {
  return async (url: string, options: RequestInit = {}) => {
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    
    // Add existing headers
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers.set(key, value)
        })
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers.set(key, value)
        })
      } else {
        Object.entries(options.headers).forEach(([key, value]) => {
          if (value) {
            headers.set(key, value)
          }
        })
      }
    }
    
    // Add store ID header if provided
    if (storeId) {
      headers.set('x-store-id', storeId)
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
    if (!currentStore?.id) {
      console.error('❌ No store selected for API call')
      throw new Error('No store selected. Please connect a Shopify store in Settings.')
    }
    
    console.log('📤 API call with store:', {
      storeId: currentStore.id,
      domain: currentStore.shop_domain,
      url
    })
    
    return createAuthenticatedFetch(currentStore.id)(url, options)
  }
}

