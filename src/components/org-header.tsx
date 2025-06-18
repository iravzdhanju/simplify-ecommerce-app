'use client';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';
import Image from 'next/image';
import { useLogoAssets } from '@/stores/theme-store';

export function OrgHeader() {
  const logoAssets = useLogoAssets();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='relative overflow-hidden group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0'
        >
          <div className='relative h-10 w-full transition-all duration-300 ease-in-out'>
            {/* Full logo for expanded sidebar */}
            <Image
              src={logoAssets.full}
              alt='Logo'
              fill
              className='transform object-contain object-left transition-all duration-300 ease-in-out group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:opacity-0'
            />
            {/* Icon only for collapsed sidebar */}
            <Image
              src={logoAssets.icon}
              alt='Logo'
              fill
              className='absolute inset-0 translate-x-2 scale-110 transform object-contain object-center opacity-0 transition-all duration-300 ease-in-out group-data-[collapsible=icon]:translate-x-0 group-data-[collapsible=icon]:scale-100 group-data-[collapsible=icon]:opacity-100'
            />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
