'use client'
import { useStores } from './useStores'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

export function useCurrentStore() {
  const { data: stores, isLoading } = useStores()
  const queryClient = useQueryClient()
  const [storeId, setStoreId] = useState<string | null>(null)

  // Load from localStorage on mount AND sync with stores
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const saved = localStorage.getItem('selected-store-id')
      console.log('🔍 Store selection check:', {
        saved,
        availableStores: stores?.map(s => ({ id: s.id, domain: s.shop_domain })) || [],
        currentStoreId: storeId
      })
      
      // If no stores available, clear everything
      if (!stores || stores.length === 0) {
        console.log('🔄 No stores available, clearing saved store')
        setStoreId(null)
        localStorage.removeItem('selected-store-id')
        return
      }
      
      // If we have a saved storeId, verify it exists in stores list
      if (saved && stores.find(s => s.id === saved)) {
        console.log('✅ Using saved store:', saved)
        setStoreId(saved)
        return
      }
      
      // If saved store doesn't exist or no saved store, use first store
      if (!saved || !stores.find(s => s.id === saved)) {
        if (stores.length > 0) {
          const firstStore = stores[0]
          console.log('🔄 No valid saved store, using first store:', firstStore.id, firstStore.shop_domain)
          setStoreId(firstStore.id)
          localStorage.setItem('selected-store-id', firstStore.id)
        }
      }
    } catch (error) {
      console.warn('Failed to access localStorage:', error)
      // Fallback: select first store if available
      if (stores && stores.length > 0) {
        setStoreId(stores[0].id)
      } else {
        setStoreId(null)
      }
    }
  }, [stores]) // Only run when stores change
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const currentStore = stores && stores.length > 0 
    ? (stores.find(s => s.id === storeId) || stores[0]) 
    : null

  const switchStore = useMutation({
    mutationFn: async (newStoreId: string) => {
      // Update localStorage first
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('selected-store-id', newStoreId)
        } catch (error) {
          console.warn('Failed to save to localStorage:', error)
        }
      }
      
      return newStoreId
    },
    onSuccess: (newStoreId) => {
      console.log('🔄 Store switch:', { from: storeId, to: newStoreId })
      console.log('📋 Available stores:', stores?.map(s => ({ id: s.id, domain: s.shop_domain })))
      
      // Update state immediately so currentStore updates
      setStoreId(newStoreId)
      
      // Remove all cached queries for the old store to prevent stale data
      queryClient.removeQueries({ queryKey: ['products'] })
      queryClient.removeQueries({ queryKey: ['analytics'] })
      queryClient.removeQueries({ queryKey: ['pricing'] })
      queryClient.removeQueries({ queryKey: ['sales'] })
      
      // Force refetch products immediately
      queryClient.invalidateQueries({ queryKey: ['products'] })
      
      const store = stores?.find(s => s.id === newStoreId)
      console.log('📍 New currentStore will be:', store?.shop_domain)
      console.log('✅ Store found:', !!store)
      
      if (!store) {
        console.error('❌ Store not found in stores list:', newStoreId)
        toast.error('Store not found')
        return
      }
      
      // Show warning if store has no scope
      if (!store.scope || store.scope.trim() === '') {
        toast.warning(`Switched to ${store.shop_domain}`, {
          description: 'This store has no permissions. Please reconnect it.',
        })
      } else {
        toast.success(`Switched to ${store.shop_domain}`, {
          description: 'Loading products...',
        })
      }
    },
    onError: (error: Error) => {
      console.error('Failed to switch store:', error);
      toast.error('Failed to switch store: ' + error.message)
    },
  })

  return { 
    currentStore, 
    stores: stores || [],
    isLoading,
    switchStore: switchStore.mutate,
    isSwitching: switchStore.isPending,
  }
}

