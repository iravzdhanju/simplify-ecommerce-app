import { Metadata } from 'next';
import OrganizationSetupForm from '@/features/onboarding/components/organization-setup-form';

export const metadata: Metadata = {
  title: 'Setup Organization',
  description: 'Set up your organization name and logo.'
};

export default function OrganizationSetupPage() {
  return (
    <div className='bg-background flex min-h-screen items-center justify-center p-4'>
      <div className='w-full max-w-md space-y-6'>
        <div className='space-y-2 text-center'>
          <h1 className='text-2xl font-bold'>Setup Your Organization</h1>
          <p className='text-muted-foreground'>
            Let&apos;s get started by setting up your organization details.
          </p>
        </div>
        <OrganizationSetupForm />
      </div>
    </div>
  );
}
