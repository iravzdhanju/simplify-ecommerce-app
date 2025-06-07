import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import OrganizationRedirect from '@/components/organization-redirect';

export default async function Page() {
  const { userId } = await auth();

  if (!userId) {
    return redirect('/auth/sign-in');
  }

  // Let the client-side component handle organization setup check
  return <OrganizationRedirect />;
}
