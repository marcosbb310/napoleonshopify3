'use client'
import { createClient } from '@/shared/lib/supabase'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useSignup() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ email, password, name }: { email: string; password: string; name: string }) => {
      console.log('🔵 Starting signup...', { email, name })
      
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        })
        
        console.log('🔵 Signup response:', { data, error })
        
        if (error) {
          console.error('🔴 Signup error:', error)
          throw error
        }
        
        // If session exists, user is auto-logged in (email confirmation disabled)
        if (data.session) {
          console.log('✅ Session created, user auto-logged in')
          return data
        }
        
        // If no session, email confirmation is required
        console.warn('⚠️ No session in response, email confirmation required')
        throw new Error('Please check your email to confirm your account')
      } catch (err) {
        console.error('🔴 Signup catch block:', err)
        throw err
      }
    },
    onSuccess: async (data) => {
      // Set the session in the cache immediately
      queryClient.setQueryData(['session'], data.session)
      // Also invalidate to trigger a refetch
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      toast.success('Account created! Welcome!')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useLogin() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      console.log('🔵 Starting login...', { email })
      
      // Check failed attempts first
      const checkRes = await fetch('/api/auth/check-login-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      
      if (!checkRes.ok) {
        const data = await checkRes.json()
        throw new Error(data.error || 'Too many failed attempts')
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      console.log('🔵 Login response:', { data, error })
      
      if (error) {
        console.error('🔴 Login error:', error)
        throw error
      }
      
      // Log successful login
      fetch('/api/auth/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'login' }),
      }).catch(console.error)
      
      console.log('✅ Login successful')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] })
      toast.success('Welcome back!')
    },
    onError: async (error: Error, variables) => {
      console.error('🔴 Login failed:', error.message)
      
      // Track failed attempt
      fetch('/api/auth/track-failed-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: variables.email }),
      }).catch(console.error)
      
      toast.error(error.message)
    },
  })
}

export function useLogout() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      // Clear session immediately for instant UI update
      queryClient.setQueryData(['session'], null)
      // Then clear other cached data
      queryClient.removeQueries({ queryKey: ['stores'] })
      queryClient.removeQueries({ queryKey: ['products'] })
      queryClient.removeQueries({ queryKey: ['analytics'] })
      toast.success('Signed out')
    },
    onError: (error: Error) => {
      toast.error('Failed to sign out: ' + error.message)
    },
  })
}

export function useMagicLink() {
  const supabase = createClient()
  
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Check your email for magic link!')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function usePasswordReset() {
  const supabase = createClient()
  
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Password reset email sent!')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

