'use client';

import { Building2, GalleryVerticalEnd } from 'lucide-react';
import * as React from 'react';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';

interface Organization {
  id: string;
  name: string;
}

export function OrgHeader({ organization }: { organization: Organization }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size='lg'>
          <div className='bg-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
            <Building2 className='size-4' />
          </div>
          <div className='flex flex-col gap-0.5 leading-none'>
            <div className='flex items-center gap-2'>
              <GalleryVerticalEnd className='size-4' />
              <span className='text-sm font-semibold'>Logo</span>
            </div>
            <span className=''>{organization.name}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
