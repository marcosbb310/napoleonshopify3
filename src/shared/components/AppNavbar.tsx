// Main application navbar
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  BarChart3,
  Settings,
  HelpCircle,
  DollarSign,
} from 'lucide-react';
import { UserMenu } from './UserMenu';

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    gradientFrom: '#a955ff',
    gradientTo: '#ea51ff',
  },
  {
    title: 'Products',
    icon: Package,
    href: '/products',
    gradientFrom: '#56CCF2',
    gradientTo: '#2F80ED',
  },
  {
    title: 'Analytics',
    icon: BarChart3,
    href: '/analytics',
    gradientFrom: '#FF9966',
    gradientTo: '#FF5E62',
  },
  {
    title: 'Settings',
    icon: Settings,
    href: '/settings',
    gradientFrom: '#80FF72',
    gradientTo: '#7EE8FA',
  },
  {
    title: 'Help',
    icon: HelpCircle,
    href: '/help',
    gradientFrom: '#ffa9c6',
    gradientTo: '#f434e2',
  },
];

export function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative flex h-16 items-center px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-semibold">Smart Pricing</span>
              <span className="text-xs text-muted-foreground">for Shopify</span>
            </div>
          </Link>
        </div>

        {/* Centered Navigation Menu */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <nav className="hidden md:flex items-center gap-3 p-1 rounded-lg bg-muted/30 border border-border/50 backdrop-blur-sm">
            {menuItems.map(({ title, icon: IconComponent, gradientFrom, gradientTo, href }) => {
              const isActive = pathname === href;
              
              return (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className="group relative flex h-9 w-9 items-center justify-center rounded-md transition-all duration-200 hover:w-[7.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  aria-label={`Navigate to ${title}`}
                >
                  {/* Background states */}
                  <div className={`
                    absolute inset-0 rounded-md transition-all duration-200
                    ${isActive 
                      ? 'bg-primary shadow-md' 
                      : 'bg-background/80 hover:bg-accent/50 border border-border/60 hover:border-border'
                    }
                  `} />
                  
                  {/* Gradient overlay on hover (non-active) */}
                  {!isActive && (
                    <div 
                      className="absolute inset-0 rounded-md opacity-0 transition-all duration-200 group-hover:opacity-20"
                      style={{
                        background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`
                      }}
                    />
                  )}

                  {/* Icon */}
                  <span className={`
                    relative z-10 transition-all duration-200 flex-shrink-0
                    group-hover:scale-0 group-hover:opacity-0
                    ${isActive 
                      ? 'text-primary-foreground' 
                      : 'text-muted-foreground group-hover:text-foreground'
                    }
                  `}>
                    <IconComponent className="h-4 w-4" />
                  </span>

                  {/* Label */}
                  <span className="
                    absolute left-9 top-1/2 -translate-y-1/2 pl-1
                    text-xs font-medium leading-none 
                    scale-0 opacity-0 transition-all duration-200 delay-75
                    group-hover:scale-100 group-hover:opacity-100
                    text-foreground whitespace-nowrap z-20 pointer-events-none
                  ">
                    {title}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Menu - Fixed to top right */}
        <div className="ml-auto flex items-center">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
