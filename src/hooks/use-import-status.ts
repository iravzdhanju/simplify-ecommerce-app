import { useState, useEffect, useCallback } from 'react'
import { importService, ImportStatusData } from '@/lib/services/import-service'

interface UseImportStatusReturn {
    status: ImportStatusData
    isImporting: boolean
    startImport: () => Promise<boolean>
    cancelImport: () => Promise<boolean>
    clearCompleted: () => void
    refresh: () => Promise<void>
}

/**
 * Simplified hook for managing import status
 * Replaces the complex zustand store with a clean API
 */
export function useImportStatus(): UseImportStatusReturn {
    const [status, setStatus] = useState<ImportStatusData>({
        status: 'idle',
        lastChecked: new Date().toISOString()
    })
    const [currentImportId, setCurrentImportId] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        try {
            const latestStatus = await importService.getImportStatus(currentImportId || undefined)
            setStatus(latestStatus)
        } catch (error) {
            console.error('Failed to refresh import status:', error)
        }
    }, [currentImportId])

    const startImport = useCallback(async (): Promise<boolean> => {
        try {
            const result = await importService.startShopifyImport()

            if (result.success) {
                setCurrentImportId(result.importId)
                setStatus({
                    status: 'pending',
                    startedAt: new Date().toISOString(),
                    lastChecked: new Date().toISOString()
                })
                return true
            } else {
                console.error('Failed to start import:', result.error)
                return false
            }
        } catch (error) {
            console.error('Error starting import:', error)
            return false
        }
    }, [])

    const cancelImport = useCallback(async (): Promise<boolean> => {
        if (!currentImportId) return false

        try {
            const cancelled = await importService.cancelImport(currentImportId)
            if (cancelled) {
                await refresh()
            }
            return cancelled
        } catch (error) {
            console.error('Error cancelling import:', error)
            return false
        }
    }, [currentImportId, refresh])

    const clearCompleted = useCallback(() => {
        if (status.status === 'completed' || status.status === 'error') {
            importService.clearCompletedImports()
            setCurrentImportId(null)
            setStatus({
                status: 'idle',
                lastChecked: new Date().toISOString()
            })
        }
    }, [status.status])

    // Auto-refresh when import is active
    useEffect(() => {
        if (status.status === 'pending' || status.status === 'importing') {
            const interval = setInterval(refresh, 3000)
            return () => clearInterval(interval)
        }
    }, [status.status, refresh])

    // Initial load
    useEffect(() => {
        refresh()
    }, [refresh])

    const isImporting = status.status === 'pending' || status.status === 'importing'

    return {
        status,
        isImporting,
        startImport,
        cancelImport,
        clearCompleted,
        refresh
    }
} 