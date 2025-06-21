import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ImportStatus {
    id: string
    platform: 'shopify' | 'amazon'
    shopName: string
    status: 'pending' | 'importing' | 'completed' | 'error'
    progress?: {
        imported: number
        total: number
        errors: string[]
    }
    startedAt: string
    completedAt?: string
    errorMessage?: string
}

interface ShopifyConnection {
    id: string
    platform: string
    connection_name: string
    is_active: boolean
    last_connected: string | null
    created_at: string
    credentials: any
}

interface ImportNotificationStore {
    activeImports: ImportStatus[]

    // Connection state
    hasConnection: boolean
    connections: ShopifyConnection[]
    connectionLoading: boolean
    lastConnectionCheck: number

    // Polling state
    isPolling: boolean
    pollCount: number
    maxPolls: number

    // Actions
    startImport: (platform: 'shopify' | 'amazon', shopName: string) => string
    updateImportProgress: (importId: string, progress: { imported: number; total: number; errors: string[] }) => void
    completeImport: (importId: string, success: boolean, errorMessage?: string) => void
    dismissImport: (importId: string) => void
    clearCompletedImports: () => void

    // Connection actions
    checkConnections: () => Promise<void>
    setConnections: (connections: ShopifyConnection[]) => void
    refreshConnections: () => Promise<void>

    // Polling actions
    startPolling: () => void
    stopPolling: () => void
    pollImportStatus: () => Promise<void>

    // Getters
    getActiveImport: (platform: 'shopify' | 'amazon') => ImportStatus | undefined
    hasActiveImports: () => boolean
    shouldShowNotifications: () => boolean

    // Utility method to clear stuck imports (for development/debugging)
    clearStuckImports: () => void

    // Force reset all state and stop polling (emergency reset)
    forceReset: () => void
}

// Simple cleanup for polling interval
const clearAllIntervals = () => {
    console.log('Clearing polling interval')
    if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
    }
}

// Export for cleanup utility
export { clearAllIntervals }

const CONNECTION_CACHE_DURATION = 30000 // 30 seconds
const MAX_POLL_ATTEMPTS = 200 // Maximum 10 minutes of polling
const POLL_INTERVAL = 3000 // 3 seconds

let pollInterval: NodeJS.Timeout | null = null

export const useImportNotificationStore = create<ImportNotificationStore>()(
    persist(
        (set, get) => ({
            activeImports: [],

            // Connection state
            hasConnection: false,
            connections: [],
            connectionLoading: false,
            lastConnectionCheck: 0,

            // Polling state
            isPolling: false,
            pollCount: 0,
            maxPolls: MAX_POLL_ATTEMPTS,

            startImport: (platform, shopName) => {
                const importId = `${platform}-${Date.now()}`
                const newImport: ImportStatus = {
                    id: importId,
                    platform,
                    shopName,
                    status: 'pending',
                    startedAt: new Date().toISOString(),
                }

                set((state) => ({
                    // Remove any existing import for this platform before starting new one
                    activeImports: [
                        ...state.activeImports.filter(imp => imp.platform !== platform),
                        newImport
                    ]
                }))

                // Start polling when import begins
                get().startPolling()

                return importId
            },

            updateImportProgress: (importId, progress) => {
                set((state) => ({
                    activeImports: state.activeImports.map(imp =>
                        imp.id === importId
                            ? {
                                ...imp,
                                status: 'importing' as const,
                                progress
                            }
                            : imp
                    )
                }))
            },

            completeImport: (importId, success, errorMessage) => {
                set((state) => ({
                    activeImports: state.activeImports.map(imp =>
                        imp.id === importId
                            ? {
                                ...imp,
                                status: success ? 'completed' as const : 'error' as const,
                                completedAt: new Date().toISOString(),
                                errorMessage
                            }
                            : imp
                    )
                }))

                // Stop polling when import completes
                get().stopPolling()

                // Auto-dismiss success notifications after 8 seconds
                if (success) {
                    setTimeout(() => {
                        get().dismissImport(importId)
                    }, 8000)
                }
            },

            dismissImport: (importId) => {
                set((state) => ({
                    activeImports: state.activeImports.filter(imp => imp.id !== importId)
                }))
            },

            clearCompletedImports: () => {
                set((state) => ({
                    activeImports: state.activeImports.filter(imp =>
                        imp.status !== 'completed' && imp.status !== 'error'
                    )
                }))
            },

            // Connection methods
            checkConnections: async () => {
                const state = get()

                // Check cache first
                const now = Date.now()
                if (now - state.lastConnectionCheck < CONNECTION_CACHE_DURATION) {
                    set({ connectionLoading: false })
                    return
                }

                try {
                    set({ connectionLoading: true })
                    const response = await fetch('/api/platform-connections')
                    if (response.ok) {
                        const data = await response.json()
                        if (data.success) {
                            get().setConnections(data.data)
                        } else {
                            get().setConnections([])
                        }
                    } else {
                        get().setConnections([])
                    }
                } catch (error) {
                    console.error('Error checking connections:', error)
                    get().setConnections([])
                } finally {
                    set({ connectionLoading: false })
                }
            },

            setConnections: (connections) => {
                const activeConnections = connections.filter(
                    (conn) => conn.platform === 'shopify' && conn.is_active
                )

                const hadConnection = get().hasConnection
                const hasConnectionNow = activeConnections.length > 0

                set({
                    connections: activeConnections,
                    hasConnection: hasConnectionNow,
                    lastConnectionCheck: Date.now(),
                })

                // If we lost connection, clear any pending/importing imports and stop polling
                if (hadConnection && !hasConnectionNow) {
                    console.log('Connection lost - clearing stuck imports and stopping polling')
                    set((state) => ({
                        activeImports: state.activeImports.filter(imp =>
                            imp.status === 'completed' || imp.status === 'error'
                        )
                    }))
                    get().stopPolling()
                    return
                }

                // Start/stop polling based on connection status and active imports
                const hasActiveImport = get().hasActiveImports()
                if (hasConnectionNow && hasActiveImport) {
                    get().startPolling()
                } else {
                    get().stopPolling()
                }
            },

            refreshConnections: async () => {
                set({ lastConnectionCheck: 0 }) // Force refresh
                await get().checkConnections()
            },

            // Polling methods
            startPolling: () => {
                const state = get()

                // Don't start if already polling or no connection
                if (state.isPolling || !state.hasConnection || state.connectionLoading) {
                    return
                }

                // Don't start if no active imports
                if (!state.hasActiveImports()) {
                    return
                }

                console.log('Starting import status polling')

                set({
                    isPolling: true,
                    pollCount: 0
                })

                pollInterval = setInterval(() => {
                    get().pollImportStatus()
                }, POLL_INTERVAL)
            },

            stopPolling: () => {
                console.log('Stopping import status polling')

                if (pollInterval) {
                    clearInterval(pollInterval)
                    pollInterval = null
                }

                set({
                    isPolling: false,
                    pollCount: 0
                })
            },

            pollImportStatus: async () => {
                const state = get()

                // Immediate checks - stop polling if conditions aren't met
                if (!state.hasConnection) {
                    console.log('Polling stopped: No connection')
                    get().stopPolling()
                    return
                }

                if (!state.hasActiveImports()) {
                    console.log('Polling stopped: No active imports')
                    get().stopPolling()
                    return
                }

                // Increment poll count
                set({ pollCount: state.pollCount + 1 })

                // Stop polling if max attempts reached
                if (state.pollCount >= state.maxPolls) {
                    console.warn('Import polling stopped after maximum attempts')
                    get().stopPolling()
                    return
                }

                try {
                    const response = await fetch('/api/sync/shopify/bulk/status')

                    if (!response.ok) {
                        console.warn('Failed to fetch import status')
                        return
                    }

                    const result = await response.json()

                    if (!result.success) {
                        console.warn('Status API returned error:', result.error)
                        return
                    }

                    const data = result.data // Extract the nested data
                    const activeImport = state.activeImports.find(
                        (imp) => imp.status === 'pending' || imp.status === 'importing'
                    )

                    if (!activeImport) {
                        console.log('Polling stopped: No active import found')
                        get().stopPolling()
                        return
                    }

                    console.log('Status polling data:', data)

                    // Check if import is no longer active (completed or failed)
                    if (!data.isActive) {
                        // Import is done - complete it
                        get().updateImportProgress(activeImport.id, {
                            imported: data.imported || 0,
                            total: data.totalProducts || 0,
                            errors: data.errorMessages || []
                        })

                        const hasErrors = (data.errors || 0) > 0
                        get().completeImport(
                            activeImport.id,
                            !hasErrors,
                            hasErrors ? `Import completed with ${data.errors} errors` : undefined
                        )

                    } else if (data.status === 'error') {
                        get().completeImport(activeImport.id, false, 'Import failed')

                    } else if (data.isActive) {
                        // Still importing - update progress
                        get().updateImportProgress(activeImport.id, {
                            imported: data.imported || 0,
                            total: data.totalProducts || 0,
                            errors: data.errorMessages || []
                        })
                    }
                } catch (error) {
                    console.error('Error polling import status:', error)
                    // On error, stop polling to prevent infinite failed requests
                    if (state.pollCount > 5) {
                        console.log('Stopping polling due to repeated errors')
                        get().stopPolling()
                    }
                }
            },

            getActiveImport: (platform) => {
                const state = get()
                return state.activeImports.find(imp =>
                    imp.platform === platform && (imp.status === 'pending' || imp.status === 'importing')
                )
            },

            hasActiveImports: () => {
                const state = get()
                return state.activeImports.some(imp =>
                    imp.status === 'pending' || imp.status === 'importing'
                )
            },

            shouldShowNotifications: () => {
                const state = get()
                return !state.connectionLoading && state.hasConnection && state.activeImports.length > 0
            },

            // Utility method to clear stuck imports (for development/debugging)
            clearStuckImports: () => {
                set((state) => ({
                    activeImports: state.activeImports.filter(imp =>
                        imp.status === 'completed' || imp.status === 'error'
                    )
                }))
                get().stopPolling()
            },

            // Force reset all state and stop polling (emergency reset)
            forceReset: () => {
                console.log('Force resetting import store and clearing ALL intervals')
                clearAllIntervals()
                set({
                    activeImports: [],
                    isPolling: false,
                    pollCount: 0
                })
            }
        }),
        {
            name: 'import-notifications',
            // Only persist certain parts of state
            partialize: (state) => ({
                activeImports: state.activeImports.filter(imp => {
                    if (imp.status === 'completed' || imp.status === 'error') {
                        const completedTime = new Date(imp.completedAt || imp.startedAt).getTime()
                        const now = Date.now()
                        // Keep completed imports for 1 hour
                        return (now - completedTime) < (60 * 60 * 1000)
                    }
                    return true
                }),
                hasConnection: state.hasConnection,
                connections: state.connections,
                lastConnectionCheck: state.lastConnectionCheck,
            })
        }
    )
)

// Clean up polling interval when page unloads
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
        }
    })

    // Also add a cleanup when the store is created
    const cleanup = () => {
        if (pollInterval) {
            console.log('Cleaning up existing polling interval')
            clearInterval(pollInterval)
            pollInterval = null
        }
    }

    // Clean up any existing intervals
    cleanup()

    // Add visibility change listener to stop polling when tab is not visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            const store = useImportNotificationStore.getState()
            if (store.isPolling && !store.hasConnection) {
                console.log('Tab hidden and no connection - stopping polling')
                store.stopPolling()
            }
        }
    })
} 