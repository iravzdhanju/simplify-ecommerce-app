import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { ImportNotification } from '@/components/import-notification';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { RealtimeToast } from '@/components/realtime-toast';

export const metadata: Metadata = {
  title: 'Next Shadcn Dashboard Starter',
  description: 'Basic dashboard with Next.js and Shadcn'
};

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Persisting the sidebar state in the cookie.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';
  return (
    <KBar>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset className='flex h-screen flex-col'>
          <Header />
          {/* page main content */}
          <div className='flex-1 overflow-auto'>{children}</div>
          {/* page main content ends */}
        </SidebarInset>
        {/* Import notifications */}
        <ImportNotification />
        <RealtimeToast />
      </SidebarProvider>
    </KBar>
  );
}
