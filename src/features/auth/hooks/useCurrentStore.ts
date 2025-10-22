'use client'
import { useStores } from './useStores'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

export function useCurrentStore() {
  const { data: stores, isLoading } = useStores()
  const queryClient = useQueryClient()
  const [storeId, setStoreId] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const saved = localStorage.getItem('selected-store-id')
      if (saved) {
        setStoreId(saved)
      }
    } catch (error) {
      console.warn('Failed to access localStorage:', error)
    }
  }, [])

  // Auto-select first store if none selected
  useEffect(() => {
    if (!stores || stores.length === 0) return
    
    // If we have a storeId but it's not in the list, clear it
    if (storeId && !stores.find(s => s.id === storeId)) {
      setStoreId(null)
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('selected-store-id')
        } catch (error) {
          console.warn('Failed to remove from localStorage:', error)
        }
      }
    }
    
    // If no store selected, select the first one
    if (!storeId && stores.length > 0) {
      const firstStore = stores[0]
      setStoreId(firstStore.id)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('selected-store-id', firstStore.id)
        } catch (error) {
          console.warn('Failed to save to localStorage:', error)
        }
      }
    }
  }, [stores, storeId])

  const currentStore = stores?.find(s => s.id === storeId) || stores?.[0] || null

  const switchStore = useMutation({
    mutationFn: async (newStoreId: string) => {
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
      setStoreId(newStoreId)
      
      // Invalidate all store-dependent data
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      
      const store = stores?.find(s => s.id === newStoreId)
      toast.success(`Switched to ${store?.shop_domain || 'store'}`)
    },
    onError: (error: Error) => {
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

