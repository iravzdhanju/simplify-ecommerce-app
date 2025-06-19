import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AuthLoading from '@/components/auth-loading';

export default async function Page() {
  const { userId } = await auth();

  if (!userId) {
    return redirect('/auth/sign-in');
  }

  // Show loading screen before redirecting to dashboard
  return <AuthLoading />;
}
