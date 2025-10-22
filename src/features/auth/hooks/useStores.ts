'use client'
import { createClient } from '@/shared/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'

export function useStores() {
  const supabase = createClient()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('installed_at', { ascending: false })
      
      if (error) {
        console.error('Failed to fetch stores:', error)
        throw error
      }
      
      return data || []
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

