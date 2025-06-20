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

interface ImportNotificationStore {
    activeImports: ImportStatus[]

    // Actions
    startImport: (platform: 'shopify' | 'amazon', shopName: string) => string
    updateImportProgress: (importId: string, progress: { imported: number; total: number; errors: string[] }) => void
    completeImport: (importId: string, success: boolean, errorMessage?: string) => void
    dismissImport: (importId: string) => void
    clearCompletedImports: () => void

    // Getters
    getActiveImport: (platform: 'shopify' | 'amazon') => ImportStatus | undefined
    hasActiveImports: () => boolean
}

export const useImportNotificationStore = create<ImportNotificationStore>()(
    persist(
        (set, get) => ({
            activeImports: [],

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
            }
        }),
        {
            name: 'import-notifications',
            // Only persist completed/error imports for a short time
            partialize: (state) => ({
                activeImports: state.activeImports.filter(imp => {
                    if (imp.status === 'completed' || imp.status === 'error') {
                        const completedTime = new Date(imp.completedAt || imp.startedAt).getTime()
                        const now = Date.now()
                        // Keep completed imports for 1 hour
                        return (now - completedTime) < (60 * 60 * 1000)
                    }
                    return true
                })
            })
        }
    )
) 