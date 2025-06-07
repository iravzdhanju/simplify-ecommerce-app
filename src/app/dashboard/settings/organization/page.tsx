import { Metadata } from 'next';
import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import OrganizationSettingsForm from '@/features/settings/components/organization-settings-form';

export const metadata: Metadata = {
  title: 'Organization Settings',
  description: 'Manage your organization settings.'
};

export default function OrganizationSettingsPage() {
  return (
    <PageContainer>
      <div className='space-y-4'>
        <Heading
          title='Organization Settings'
          description='Manage your organization name and logo.'
        />
        <OrganizationSettingsForm />
      </div>
    </PageContainer>
  );
}
