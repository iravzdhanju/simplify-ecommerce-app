'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface ThemeAssets {
    logo: {
        full: string;
        icon: string;
    };
}

interface ThemeStore {
    isDark: boolean;
    resolvedTheme: string | undefined;
    assets: ThemeAssets;

    // Actions
    setTheme: (theme: string | undefined) => void;
    updateAssets: () => void;
}

// Helper function to get theme-aware assets
const getThemeAssets = (isDark: boolean): ThemeAssets => ({
    logo: {
        full: isDark ? '/assets/tt-logo-dark.svg' : '/assets/tt-logo.svg',
        icon: isDark ? '/assets/tt-logo-icon.svg' : '/assets/tt-logo-icon.svg'
    }
});

// Create Zustand store for theme management
export const useThemeStore = create<ThemeStore>()(
    subscribeWithSelector((set, get) => ({
        isDark: false,
        resolvedTheme: undefined,
        assets: getThemeAssets(false), // Default to light theme assets

        setTheme: (theme: string | undefined) => {
            const isDark = theme === 'dark';
            const assets = getThemeAssets(isDark);

            set({
                resolvedTheme: theme,
                isDark,
                assets
            });
        },

        updateAssets: () => {
            const { isDark } = get();
            const assets = getThemeAssets(isDark);
            set({ assets });
        }
    }))
);

/**
 * Performance-optimized hook to check if current theme is dark
 * Uses Zustand store for better performance and fewer re-renders
 */
export function useIsDarkTheme(): boolean {
    return useThemeStore((state) => state.isDark);
}

/**
 * Hook that provides theme-aware asset paths
 * Uses Zustand store for optimal performance
 */
export function useThemeAssets(): ThemeAssets {
    return useThemeStore((state) => state.assets);
}

/**
 * Hook to get specific logo assets
 * More specific selector for components that only need logo assets
 */
export function useLogoAssets() {
    return useThemeStore((state) => state.assets.logo);
} 