/**
 * Polling cleanup utility
 * Provides emergency stop for import polling
 */

import { clearAllIntervals } from '@/stores/import-notification-store'

/**
 * Stop all import polling immediately
 * Use this when connections are deleted or polling gets stuck
 */
export const stopAllPolling = () => {
    console.log('🛑 Stopping all import polling')
    clearAllIntervals()
    console.log('✅ Polling stopped')
}

/**
 * Add to window for debugging in development
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    ; (window as any).stopPolling = stopAllPolling
} 