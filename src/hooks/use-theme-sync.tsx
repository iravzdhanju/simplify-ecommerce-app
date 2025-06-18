'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { useThemeStore } from '@/stores/theme-store';

/**
 * Hook that synchronizes next-themes with our Zustand store
 * This should be used once at the app level to keep themes in sync
 */
export function useThemeSync() {
  const { resolvedTheme } = useTheme();
  const setTheme = useThemeStore((state) => state.setTheme);

  useEffect(() => {
    setTheme(resolvedTheme);
  }, [resolvedTheme, setTheme]);
}
