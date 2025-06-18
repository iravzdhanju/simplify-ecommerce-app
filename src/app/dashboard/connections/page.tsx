import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import ConnectionsPage from '@/features/connections/components/connections-page';

export default function Page() {
  return (
    <div className='flex-1 space-y-4 p-4 pt-6 md:p-8'>
      <div className='flex items-center justify-between space-y-2'>
        <h2 className='text-3xl font-bold tracking-tight'>
          Platform Connections
        </h2>
      </div>

      <Suspense fallback={<ConnectionsPageSkeleton />}>
        <ConnectionsPage />
      </Suspense>
    </div>
  );
}

function ConnectionsPageSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Skeleton className='h-32' />
        <Skeleton className='h-32' />
        <Skeleton className='h-32' />
      </div>
      <Skeleton className='h-64' />
    </div>
  );
}
