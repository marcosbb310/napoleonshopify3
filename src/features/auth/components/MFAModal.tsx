'use client'
import { useState } from 'react'
import QRCode from 'react-qr-code'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { createClient } from '@/shared/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'

export function MFAModal({ open, onOpenChange, mode }: { 
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'setup' | 'challenge'
}) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [code, setCode] = useState('')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [factorId, setFactorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  const startSetup = async () => {
    setLoading(true)
    try {
      // Check for existing factors first
      const { data: existingFactors } = await supabase.auth.mfa.listFactors()
      
      console.log('Existing MFA factors:', existingFactors)
      
      // If there are existing factors (verified or unverified), unenroll them all
      if (existingFactors?.totp && existingFactors.totp.length > 0) {
        toast.info(`Removing ${existingFactors.totp.length} existing factor(s)...`)
        
        for (const factor of existingFactors.totp) {
          console.log('Unenrolling factor:', factor.id, 'Status:', factor.status)
          const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
          
          if (unenrollError) {
            console.error('Failed to unenroll factor:', unenrollError)
            // Continue anyway, try to enroll a new one
          }
        }
      }
      
      // Now enroll a new factor with a unique friendly name
      const timestamp = Date.now()
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator-${timestamp}`,
      })
      
      if (error) {
        console.error('MFA enrollment error:', error)
        toast.error(error.message)
        return
      }
      
      console.log('MFA enrollment successful:', data)
      
      // Use the URI field (not qr_code which is a base64 image)
      const uri = data.totp.uri
      
      setQrCode(uri)
      setSecret(data.totp.secret)
      setFactorId(data.id)
      
      // Generate backup codes (10 random codes)
      const codes = Array.from({ length: 10 }, () => 
        Math.random().toString(36).substring(2, 8).toUpperCase()
      )
      setBackupCodes(codes)
      
      toast.success('MFA setup ready!')
    } catch (error: any) {
      console.error('Start setup error:', error)
      toast.error(error.message || 'Failed to start MFA setup')
    } finally {
      setLoading(false)
    }
  }
  
  const verifyAndComplete = async () => {
    if (!factorId || !code) {
      toast.error('Please enter the 6-digit code')
      return
    }
    
    setLoading(true)
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      
      if (challenge.error) {
        toast.error(challenge.error.message)
        return
      }
      
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      })
      
      if (verify.error) {
        toast.error('Invalid code. Please try again.')
        return
      }
      
      toast.success('MFA enabled successfully!')
      queryClient.invalidateQueries({ queryKey: ['session'] })
      onOpenChange(false)
      
      // Reset state
      setCode('')
      setQrCode(null)
      setSecret(null)
      setBackupCodes([])
      setFactorId(null)
    } catch (error: any) {
      toast.error(error.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }
  
  const verifyChallenge = async () => {
    // This would be used during login when MFA is required
    // For now, just close the modal
    toast.info('Challenge verification not implemented yet')
    onOpenChange(false)
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'setup' ? 'Setup Two-Factor Authentication' : 'Enter MFA Code'}
          </DialogTitle>
        </DialogHeader>
        
        {mode === 'setup' ? (
          <div className="space-y-4">
            {!qrCode ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account by enabling two-factor authentication.
                </p>
                <Button onClick={startSetup} disabled={loading} className="w-full">
                  {loading ? 'Setting up...' : 'Start Setup'}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <QRCode value={qrCode} size={200} />
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Manual Entry Code:</p>
                    <code className="block p-2 bg-muted rounded text-sm text-center font-mono">
                      {secret}
                    </code>
                    <p className="text-xs text-muted-foreground">
                      Scan the QR code with Google Authenticator, Authy, or any TOTP app
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="mfa-code">Enter 6-digit code to verify</Label>
                    <Input 
                      id="mfa-code"
                      value={code} 
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      maxLength={6}
                      placeholder="000000"
                      className="text-center text-lg tracking-wider"
                    />
                  </div>
                  
                  {backupCodes.length > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg space-y-2">
                      <p className="font-semibold text-sm">⚠️ Backup Codes (Save These!)</p>
                      <p className="text-xs text-muted-foreground">
                        Store these codes in a safe place. You can use them to access your account if you lose your device.
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded">
                        {backupCodes.map((code, i) => (
                          <div key={i} className="text-center">{code}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Button 
                    onClick={verifyAndComplete} 
                    disabled={loading || code.length !== 6}
                    className="w-full"
                  >
                    {loading ? 'Verifying...' : 'Complete Setup'}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app
            </p>
            <div>
              <Label htmlFor="challenge-code">6-digit code</Label>
              <Input 
                id="challenge-code"
                value={code} 
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                placeholder="000000"
                className="text-center text-lg tracking-wider"
              />
            </div>
            <Button 
              onClick={verifyChallenge} 
              disabled={loading || code.length !== 6}
              className="w-full"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

