'use client'
import { createClient } from '@/shared/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

export function useAuth() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: session, isLoading, error } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        console.log('🔐 Checking authentication...');
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('❌ Auth session error:', error);
          throw error;
        }
        console.log('✅ Auth session result:', session ? 'authenticated' : 'not authenticated');
        return session
      } catch (error) {
        console.error('❌ Auth query failed:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false, // Don't retry on error
  })

  // Listen to auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      queryClient.setQueryData(['session'], session)
      
      if (event === 'SIGNED_IN') {
        queryClient.invalidateQueries({ queryKey: ['stores'] })
      }
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
      }
    })
    
    return () => subscription.unsubscribe()
  }, [queryClient, supabase])

  // Auto-refresh session before expiry (50 minutes before 1 hour expiry)
  useEffect(() => {
    if (!session) return

    const refreshInterval = setInterval(async () => {
      const { data } = await supabase.auth.refreshSession()
      if (data.session) {
        queryClient.setQueryData(['session'], data.session)
      }
    }, 50 * 60 * 1000) // 50 minutes
    
    return () => clearInterval(refreshInterval)
  }, [session, supabase, queryClient])

  return {
    user: session?.user ?? null,
    session,
    isLoading,
    isAuthenticated: !!session,
    error,
  }
}

