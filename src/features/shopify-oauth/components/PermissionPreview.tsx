'use client';

import { Card, CardContent } from '@/shared/components/ui/card';
import { Package, Edit, ShoppingCart } from 'lucide-react';
import type { PermissionPreviewProps } from '../types';

/**
 * Permission Preview Component
 * 
 * Shows what permissions the app will request
 */
export function PermissionPreview({ shopDomain, scopes }: PermissionPreviewProps) {
  const permissions = [
    {
      scope: 'read_products',
      icon: <Package className="h-5 w-5 text-blue-500" />,
      title: 'Read Products',
      description: 'View your product catalog, pricing, and inventory levels',
    },
    {
      scope: 'write_products',
      icon: <Edit className="h-5 w-5 text-green-500" />,
      title: 'Update Products',
      description: 'Automatically adjust product prices based on your pricing rules',
    },
    {
      scope: 'read_orders',
      icon: <ShoppingCart className="h-5 w-5 text-purple-500" />,
      title: 'Read Orders',
      description: 'Analyze sales data to optimize pricing strategies',
    },
  ];

  const requestedPermissions = permissions.filter(p => 
    scopes.includes(p.scope)
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Permissions for {shopDomain}</h4>
            <span className="text-xs text-muted-foreground">
              {requestedPermissions.length} permissions
            </span>
          </div>

          <div className="space-y-3">
            {requestedPermissions.map((permission, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="mt-0.5">{permission.icon}</div>
                <div className="flex-1">
                  <h5 className="text-sm font-medium">{permission.title}</h5>
                  <p className="text-xs text-muted-foreground">
                    {permission.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              You can revoke these permissions at any time from your Shopify admin panel.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
