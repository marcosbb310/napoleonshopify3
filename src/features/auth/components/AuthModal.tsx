'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { useSignup, useLogin, useMagicLink, usePasswordReset } from '../hooks/useAuthMutations'

export function AuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  
  const signup = useSignup()
  const login = useLogin()
  const magicLink = useMagicLink()
  const resetPassword = usePasswordReset()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Smart Pricing</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="signup">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
            <TabsTrigger value="login">Log In</TabsTrigger>
            <TabsTrigger value="magic">Magic Link</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signup" className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button 
              onClick={() => signup.mutate({ email, password, name })}
              disabled={signup.isPending}
              className="w-full"
            >
              Create Account
            </Button>
          </TabsContent>
          
          <TabsContent value="login" className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button 
              onClick={() => login.mutate({ email, password })}
              disabled={login.isPending}
              className="w-full"
            >
              Sign In
            </Button>
            <Button 
              variant="link" 
              onClick={() => resetPassword.mutate({ email })}
              className="w-full"
            >
              Forgot password?
            </Button>
          </TabsContent>
          
          <TabsContent value="magic" className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button 
              onClick={() => magicLink.mutate({ email })}
              disabled={magicLink.isPending}
              className="w-full"
            >
              Send Magic Link
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

