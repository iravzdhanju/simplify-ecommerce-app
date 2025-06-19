'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function AuthLoading() {
  const router = useRouter();
  const [isHiding, setIsHiding] = useState(false);

  useEffect(() => {
    // Single timer for both animation and redirect
    const hideTimer = setTimeout(() => setIsHiding(true), 1000);
    const redirectTimer = setTimeout(
      () => router.push('/dashboard/overview'),
      1400
    );

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(redirectTimer);
    };
  }, [router]);

  return (
    <div className='bg-background flex min-h-screen items-center justify-center'>
      <div
        className='relative will-change-transform'
        style={{
          transform: isHiding
            ? 'scale(0.8) translateY(-20px)'
            : 'scale(1) translateY(0px)',
          opacity: isHiding ? 0 : 1,
          filter: isHiding ? 'blur(4px)' : 'blur(0px)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* TT Logo - optimized with priority and proper sizing */}
        <Image
          src='/assets/tt-logo-icon.svg'
          alt='TT Logo'
          width={64}
          height={64}
          priority
          className='relative z-10 animate-pulse'
          style={{ willChange: 'opacity' }}
        />

        {/* Single optimized glow effect */}
        <div
          className='bg-primary/15 absolute inset-0 h-16 w-16 animate-pulse rounded-full'
          style={{
            filter: 'blur(16px)',
            willChange: 'opacity',
            animationDuration: '2s'
          }}
        />
      </div>
    </div>
  );
}
