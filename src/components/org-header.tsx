'use client';

import { Building2, GalleryVerticalEnd } from 'lucide-react';
import * as React from 'react';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';
import { useOrganizationStore } from '@/stores/organization-store';

export function OrgHeader() {
  const { organization } = useOrganizationStore();

  // Default fallback organization
  const displayOrg = organization || {
    id: 'default',
    name: 'My Organization',
    logo: undefined,
    isSetup: false
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size='lg'>
          <div className='bg-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg'>
            {displayOrg.logo ? (
              <img
                src={displayOrg.logo}
                alt={`${displayOrg.name} logo`}
                className='h-full w-full object-cover'
              />
            ) : (
              <Building2 className='size-4' />
            )}
          </div>
          <div className='flex flex-col gap-0.5 leading-none'>
            <div className='flex items-center gap-2'>
              <GalleryVerticalEnd className='size-4' />
              <span className='text-sm font-semibold'>
                {displayOrg.logo ? 'Logo' : 'Default'}
              </span>
            </div>
            <span className=''>{displayOrg.name}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
