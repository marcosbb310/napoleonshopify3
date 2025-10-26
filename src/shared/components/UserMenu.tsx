// User menu component for header
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { 
  Settings, 
  LogOut, 
  ChevronDown, 
  Store, 
  CreditCard, 
  HelpCircle,
  MessageSquare,
  Moon,
  Sun,
  Monitor,
  Key,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/shared/components/ui/dropdown-menu';
import { Badge } from '@/shared/components/ui/badge';
import { useAuth, useCurrentStore } from '@/features/auth';
import { createClient } from '@/shared/lib/supabase';
import { toast } from 'sonner';

export function UserMenu() {
  const { user } = useAuth();
  const { currentStore, stores } = useCurrentStore();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  
  // Real store data from useCurrentStore
  const connectedStore = currentStore ? {
    name: currentStore.shop_domain.replace('.myshopify.com', ''),
    domain: currentStore.shop_domain,
    isConnected: true,
  } : {
    name: 'No Store',
    domain: '',
    isConnected: false,
  };
  
  const userPlan = {
    name: 'Pro Plan',
    tier: 'pro', // 'free', 'pro', 'enterprise'
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Signed out');
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to sign out');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-auto py-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium">{user?.email?.[0] || 'D'}</span>
          </div>
          <div className="hidden md:flex flex-col items-start">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium leading-none">{user?.email || 'Demo User'}</span>
              {userPlan.tier === 'pro' && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">Pro</Badge>
              )}
              {userPlan.tier === 'enterprise' && (
                <Badge variant="default" className="text-xs px-1.5 py-0 h-4">Enterprise</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{user?.email || 'demo@example.com'}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {/* User Info Header */}
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.email || 'Demo User'}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || 'demo@example.com'}
                </p>
              </div>
              {userPlan.tier === 'pro' && (
                <Badge variant="secondary">Pro Plan</Badge>
              )}
              {userPlan.tier === 'enterprise' && (
                <Badge variant="default">Enterprise</Badge>
              )}
              {userPlan.tier === 'free' && (
                <Badge variant="outline">Free Plan</Badge>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {/* Connected Store Status */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Store className="h-3.5 w-3.5" />
              <span className="text-muted-foreground">Connected Store</span>
            </div>
            {connectedStore.isConnected ? (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Disconnected</span>
              </div>
            )}
          </div>
          {connectedStore.isConnected && (
            <div className="mt-1 pl-5 text-xs text-foreground">
              {connectedStore.name}
              <div className="text-muted-foreground">{connectedStore.domain}</div>
            </div>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {/* Settings */}
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        
        {/* API Keys */}
        <DropdownMenuItem asChild>
          <Link href="/settings?tab=integrations" className="cursor-pointer">
            <Key className="mr-2 h-4 w-4" />
            <span>API Keys</span>
          </Link>
        </DropdownMenuItem>
        
        {/* Billing */}
        <DropdownMenuItem asChild>
          <Link href="/settings?tab=billing" className="cursor-pointer">
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Billing & Subscription</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Theme Toggle */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="ml-6">Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme('light')} className="cursor-pointer">
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer">
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')} className="cursor-pointer">
                <Monitor className="mr-2 h-4 w-4" />
                <span>System</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        
        <DropdownMenuSeparator />
        
        {/* Help & Support */}
        <DropdownMenuItem asChild>
          <Link href="/help" className="cursor-pointer">
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Help & Support</span>
          </Link>
        </DropdownMenuItem>
        
        {/* Send Feedback */}
        <DropdownMenuItem asChild>
          <Link href="/feedback" className="cursor-pointer">
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Send Feedback</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Sign Out */}
        <DropdownMenuItem 
          onSelect={(e) => {
            e.preventDefault();
            handleLogout();
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

