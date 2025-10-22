'use client'
import { useAuth } from '@/features/auth'
import { MFAModal } from '@/features/auth/components/MFAModal'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { createClient } from '@/shared/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { Shield, Clock, MapPin, Smartphone } from 'lucide-react'

export default function SecurityPage() {
  const { user } = useAuth()
  const [showMFA, setShowMFA] = useState(false)
  const supabase = createClient()

  const { data: auditLog, isLoading } = useQuery({
    queryKey: ['audit-log', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data } = await supabase
        .from('auth_events')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(20)
      
      return data || []
    },
    enabled: !!user,
  })

  const { data: mfaStatus } = useQuery({
    queryKey: ['mfa-status', user?.id],
    queryFn: async () => {
      if (!user) return { enabled: false }
      
      const { data } = await supabase.auth.mfa.listFactors()
      return {
        enabled: data?.totp?.length > 0,
        factors: data?.totp || []
      }
    },
    enabled: !!user,
  })

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Security Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account security and view recent activity
        </p>
      </div>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mfaStatus?.enabled ? (
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium">MFA Enabled</p>
                  <p className="text-sm text-muted-foreground">
                    Your account is protected with two-factor authentication
                  </p>
                </div>
              </div>
              <Button variant="outline" disabled>
                Manage
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Two-factor authentication adds an extra layer of security by requiring a code from your phone in addition to your password.
              </p>
              <Button onClick={() => setShowMFA(true)}>
                Enable Two-Factor Authentication
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Recent Activity</CardTitle>
          </div>
          <CardDescription>
            View your recent account activity and login history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading activity...
            </div>
          ) : auditLog && auditLog.length > 0 ? (
            <div className="space-y-2">
              {auditLog.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-1">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium capitalize">
                        {event.event_type.replace(/_/g, ' ')}
                      </p>
                      <span className="text-sm text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {event.ip_address && (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.ip_address}
                        </div>
                        {event.user_agent && (
                          <span className="truncate max-w-md">
                            {event.user_agent}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No recent activity to display
            </div>
          )}
        </CardContent>
      </Card>

      <MFAModal open={showMFA} onOpenChange={setShowMFA} mode="setup" />
    </div>
  )
}

