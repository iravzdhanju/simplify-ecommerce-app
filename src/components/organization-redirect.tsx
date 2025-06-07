'use client';

import { useOrganizationStore } from '@/stores/organization-store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrganizationRedirect() {
  const { organization } = useOrganizationStore();
  const router = useRouter();

  useEffect(() => {
    if (!organization || !organization.isSetup) {
      router.push('/onboarding/organization');
    } else {
      router.push('/dashboard/overview');
    }
  }, [organization, router]);

  // Show loading state while redirecting
  return (
    <div className='flex min-h-screen items-center justify-center'>
      <div className='w-full max-w-md space-y-6 p-6'>
        {/* Logo/Brand area skeleton */}
        <div className='flex justify-center'>
          <Skeleton className='h-12 w-12 rounded-lg' />
        </div>

        {/* Title skeleton */}
        <div className='space-y-2 text-center'>
          <Skeleton className='mx-auto h-6 w-48' />
          <Skeleton className='mx-auto h-4 w-32' />
        </div>

        {/* Progress indicator */}
        <div className='space-y-3'>
          <Skeleton className='h-2 w-full rounded-full' />
          <div className='flex justify-center'>
            <Skeleton className='h-4 w-24' />
          </div>
        </div>
      </div>
    </div>
  );
}
