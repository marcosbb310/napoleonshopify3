'use client'
import { useAuth } from './useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState } from 'react'

export function useShopifyOAuth() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isConnecting, setIsConnecting] = useState(false)

  function initiateOAuth() {
    if (!user) {
      toast.error('Please sign in first to connect a Shopify store')
      return
    }

    const shop = prompt('Enter your Shopify store domain\n(e.g., mystore.myshopify.com)')
    
    if (!shop) return
    
    // Basic validation
    if (!shop.includes('.myshopify.com') && !shop.includes('.')) {
      toast.error('Please enter a valid Shopify domain (e.g., mystore.myshopify.com)')
      return
    }

    setIsConnecting(true)
    
    // Open OAuth popup
    const width = 600
    const height = 700
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2
    
    const popup = window.open(
      `/api/auth/shopify?shop=${encodeURIComponent(shop)}`,
      'shopify-oauth',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    )

    if (!popup) {
      toast.error('Please allow popups for this site')
      setIsConnecting(false)
      return
    }

    // Poll for popup closure
    const interval = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(interval)
        setIsConnecting(false)
        
        // Refresh stores list
        queryClient.invalidateQueries({ queryKey: ['stores'] })
        toast.success('Store connected successfully!')
      }
    }, 500)

    // Timeout after 5 minutes
    setTimeout(() => {
      if (popup && !popup.closed) {
        popup.close()
      }
      clearInterval(interval)
      setIsConnecting(false)
    }, 5 * 60 * 1000)
  }

  return { 
    initiateOAuth,
    isConnecting,
  }
}

