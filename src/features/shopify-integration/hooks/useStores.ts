'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/shared/lib/supabase'
import { toast } from 'sonner'

export interface Store {
  id: string
  shop_domain: string
  scope: string
  installed_at: string
  last_synced_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Connection status (computed)
  connection_status: 'connected' | 'disconnected' | 'error'
  product_count?: number
  last_sync_status?: 'success' | 'failed' | 'in_progress'
}

export function useStores() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Get current user for query key
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      return session
    },
    staleTime: 5 * 60 * 1000,
  })
  
  const user = session?.user

  // Fetch user's stores
  const { data: stores = [], isLoading, error } = useQuery({
    queryKey: ['stores', user?.id],
    queryFn: async () => {
      console.log('🔍 Fetching stores...')
      
      // Check user authentication first
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('❌ No authenticated user')
        return []
      }
      
      console.log('👤 Authenticated user:', user.id)
      
      const { data, error } = await supabase
        .from('stores')
        .select(`
          id,
          shop_domain,
          scope,
          installed_at,
          last_synced_at,
          is_active,
          created_at,
          updated_at,
          user_id
        `)
        .eq('is_active', true)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('❌ Failed to fetch stores:', error)
        throw error
      }

      console.log('✅ Stores fetched successfully:', data)

      // Add computed connection status
      const storesWithStatus: Store[] = data.map(store => ({
        ...store,
        connection_status: 'connected' as const, // We'll verify this separately
        product_count: 0, // We'll fetch this separately
        last_sync_status: 'success' as const, // We'll determine this from sync_status
      }))

      console.log('📋 Processed stores:', storesWithStatus)
      return storesWithStatus
    },
    staleTime: 30 * 1000, // 30 seconds - shorter for more responsive updates
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3, // Retry failed requests 3 times
    retryDelay: 1000, // Wait 1 second between retries
    enabled: !!user, // Only run query when user is authenticated
  })

  // Test store connection
  const testConnection = useMutation({
    mutationFn: async (storeId: string) => {
      const response = await fetch(`/api/shopify/test-connection?storeId=${storeId}`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Connection test failed')
      }
      
      return result
    },
    onSuccess: () => {
      toast.success('Store connection verified!')
      queryClient.invalidateQueries({ queryKey: ['stores'] })
    },
    onError: (error) => {
      toast.error(`Connection test failed: ${error.message}`)
    },
  })

  // Disconnect store
  const disconnectStore = useMutation({
    mutationFn: async (storeId: string) => {
      // Check current user session
      const { data: { user } } = await supabase.auth.getUser()
      
      // Check if user exists in users table
      const { data: userRecord } = await supabase
        .from('users')
        .select('id, auth_user_id, email')
        .eq('auth_user_id', user?.id)
        .single()
      
      // First, let's check what stores exist before the update
      const { data: beforeData } = await supabase
        .from('stores')
        .select('id, shop_domain, is_active, user_id')
        .eq('id', storeId)
      
      // Check if the store belongs to the current user
      if (beforeData && beforeData.length > 0) {
        const store = beforeData[0]
        if (store.user_id !== userRecord?.id) {
          throw new Error('You do not have permission to disconnect this store')
        }
      } else {
        throw new Error('Store not found')
      }
      
      const { data, error } = await supabase
        .from('stores')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId)
        .select()

      if (error) {
        console.error('Disconnect store error:', error)
        throw error
      }
      
      return { storeId, data }
    },
    onSuccess: ({ storeId, data }) => {
      toast.success('Store disconnected successfully')
      
      // Clear localStorage if the disconnected store was the selected one
      if (typeof window !== 'undefined') {
        const savedStoreId = localStorage.getItem('selected-store-id')
        if (savedStoreId === storeId) {
          localStorage.removeItem('selected-store-id')
        }
      }
      
      // Invalidate and refetch to ensure we get the actual database state
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      queryClient.invalidateQueries({ queryKey: ['store-sync-statuses'] })
    },
    onError: (error) => {
      console.error('Disconnect mutation error:', error)
      toast.error(`Failed to disconnect store: ${error.message}`)
    },
  })

  // Get store sync status
  const { data: syncStatuses = {} } = useQuery({
    queryKey: ['store-sync-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_status')
        .select('store_id, status, products_synced, total_products, started_at, completed_at, error_message')
        .order('started_at', { ascending: false })

      // Table might not exist yet, silently fail
      if (error) {
        if (error.code === 'PGRST116') {
          // Table doesn't exist, return empty object
          return {}
        }
        // Other errors, log quietly
        return {}
      }

      // Group by store_id and get latest status
      const statusMap: Record<string, { store_id: string; started_at: string; status: string }> = {}
      data.forEach(status => {
        if (!statusMap[status.store_id] || new Date(status.started_at) > new Date(statusMap[status.store_id].started_at)) {
          statusMap[status.store_id] = status
        }
      })

      return statusMap
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  })

  console.log('🔄 useStores hook state:', { stores: stores.length, isLoading, error: !!error })
  
  return {
    stores,
    isLoading,
    error,
    testConnection,
    disconnectStore,
    syncStatuses,
  }
}
