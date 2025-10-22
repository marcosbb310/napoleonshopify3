'use client'
import { useAuth } from '@/features/auth'
import { AuthModal } from '@/features/auth/components/AuthModal'
import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { useLogout } from '@/features/auth/hooks/useAuthMutations'

export default function TestAuthPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const logout = useLogout()
  const [showAuth, setShowAuth] = useState(false)

  // Auto-close modal when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setShowAuth(false)
    }
  }, [isAuthenticated])

  if (isLoading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Auth Test Page</h1>
      
      {isAuthenticated ? (
        <div className="space-y-4">
          <div className="p-4 bg-green-100 rounded">
            <p className="font-semibold">✅ Authenticated</p>
            <p>Email: {user?.email}</p>
            <p>ID: {user?.id}</p>
          </div>
          <Button 
            onClick={() => logout.mutate()} 
            disabled={logout.isPending}
          >
            {logout.isPending ? 'Signing out...' : 'Sign Out'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-yellow-100 rounded">
            <p>❌ Not authenticated</p>
          </div>
          <Button onClick={() => setShowAuth(true)}>
            Open Auth Modal
          </Button>
        </div>
      )}

      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </div>
  )
}

