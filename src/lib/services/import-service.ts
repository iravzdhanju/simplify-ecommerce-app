import { ShopifyBulkSync } from '@/lib/shopify/bulk-sync'
import { getActiveShopifyConnections } from '@/lib/supabase/platform-connections'
import { createClient } from '@/lib/supabase/server'
import { getClerkUserId } from '@/lib/supabase/auth'

export type ImportStatus = 'idle' | 'pending' | 'importing' | 'completed' | 'error'

export interface ImportProgress {
    imported: number
    total: number
    errors: string[]
    currentOperation?: string
}

export interface ImportResult {
    success: boolean
    imported: number
    skipped: number
    errors: string[]
    duration: number
}

export interface ImportStatusData {
    status: ImportStatus
    progress?: ImportProgress
    startedAt?: string
    completedAt?: string
    errorMessage?: string
    lastChecked: string
}

/**
 * Unified Import Service
 * Handles all import operations, status tracking, and real-time updates
 */
export class ImportService {
    private static instance: ImportService
    private statusCache = new Map<string, ImportStatusData>()

    static getInstance(): ImportService {
        if (!ImportService.instance) {
            ImportService.instance = new ImportService()
        }
        return ImportService.instance
    }

    /**
     * Start a Shopify import operation
     */
    async startShopifyImport(): Promise<{ success: boolean; importId: string; error?: string }> {
        try {
            const connections = await getActiveShopifyConnections()

            if (connections.length === 0) {
                return {
                    success: false,
                    importId: '',
                    error: 'No active Shopify connections found'
                }
            }

            const connection = connections[0]
            const credentials = connection.credentials as any

            if (!credentials?.shop_domain || !credentials?.access_token) {
                return {
                    success: false,
                    importId: '',
                    error: 'Invalid Shopify credentials'
                }
            }

            const importId = `shopify-${Date.now()}`
            const clerkUserId = await getClerkUserId()

            if (!clerkUserId) {
                return {
                    success: false,
                    importId: '',
                    error: 'User not authenticated'
                }
            }

            // Initialize status
            this.updateStatus(importId, {
                status: 'pending',
                startedAt: new Date().toISOString(),
                lastChecked: new Date().toISOString()
            })

            // Start background import
            this.performImport(importId, credentials, clerkUserId).catch(error => {
                console.error('Background import failed:', error)
                this.updateStatus(importId, {
                    status: 'error',
                    errorMessage: error.message,
                    completedAt: new Date().toISOString(),
                    lastChecked: new Date().toISOString()
                })
            })

            return { success: true, importId }

        } catch (error) {
            return {
                success: false,
                importId: '',
                error: error instanceof Error ? error.message : 'Failed to start import'
            }
        }
    }

    /**
     * Get current import status
     */
    async getImportStatus(importId?: string): Promise<ImportStatusData> {
        if (importId && this.statusCache.has(importId)) {
            const cached = this.statusCache.get(importId)!

            // Update from database if status is active
            if (cached.status === 'pending' || cached.status === 'importing') {
                return await this.refreshStatusFromDB(importId)
            }

            return cached
        }

        // Get latest import status from database
        const supabase = await createClient()
        const { data } = await supabase
            .from('sync_logs')
            .select('*')
            .eq('platform', 'shopify')
            .eq('operation', 'bulk_import')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!data) {
            return {
                status: 'idle',
                lastChecked: new Date().toISOString()
            }
        }

        const status: ImportStatusData = {
            status: this.mapDBStatusToImportStatus(data.status),
            startedAt: data.created_at,
            completedAt: data.updated_at !== data.created_at ? data.updated_at : undefined,
            errorMessage: data.status === 'error' ? data.message : undefined,
            lastChecked: new Date().toISOString()
        }

        // Get progress data
        if (status.status === 'importing' || status.status === 'completed') {
            const progressData = await this.getProgressData()
            status.progress = progressData
        }

        return status
    }

    /**
     * Cancel an ongoing import
     */
    async cancelImport(importId: string): Promise<boolean> {
        const status = this.statusCache.get(importId)

        if (!status || (status.status !== 'pending' && status.status !== 'importing')) {
            return false
        }

        this.updateStatus(importId, {
            status: 'error',
            errorMessage: 'Import cancelled by user',
            completedAt: new Date().toISOString(),
            lastChecked: new Date().toISOString()
        })

        return true
    }

    /**
 * Clear completed imports from cache
 */
    clearCompletedImports(): void {
        const entries = Array.from(this.statusCache.entries())
        for (const [id, status] of entries) {
            if (status.status === 'completed' || status.status === 'error') {
                this.statusCache.delete(id)
            }
        }
    }

    private async performImport(
        importId: string,
        credentials: any,
        clerkUserId: string
    ): Promise<void> {
        try {
            this.updateStatus(importId, {
                status: 'importing',
                progress: { imported: 0, total: 0, errors: [] },
                lastChecked: new Date().toISOString()
            })

            const bulkSync = new ShopifyBulkSync(credentials)

            // Start periodic progress tracking
            const progressInterval = setInterval(async () => {
                try {
                    const progressData = await this.getProgressData()
                    this.updateStatus(importId, {
                        status: 'importing',
                        progress: progressData,
                        lastChecked: new Date().toISOString()
                    })
                } catch (error) {
                    console.warn('Failed to update progress:', error)
                }
            }, 2000)

            const result = await bulkSync.performFullProductImport()

            // Clear progress tracking
            clearInterval(progressInterval)

            this.updateStatus(importId, {
                status: 'completed',
                progress: {
                    imported: result.successfulImports,
                    total: result.totalProducts,
                    errors: result.errors
                },
                completedAt: new Date().toISOString(),
                lastChecked: new Date().toISOString()
            })

        } catch (error) {
            this.updateStatus(importId, {
                status: 'error',
                errorMessage: error instanceof Error ? error.message : 'Import failed',
                completedAt: new Date().toISOString(),
                lastChecked: new Date().toISOString()
            })
        }
    }

    private updateStatus(importId: string, status: Partial<ImportStatusData>): void {
        const current = this.statusCache.get(importId) || {
            status: 'idle' as ImportStatus,
            lastChecked: new Date().toISOString()
        }

        this.statusCache.set(importId, { ...current, ...status })
    }

    private async refreshStatusFromDB(importId: string): Promise<ImportStatusData> {
        const supabase = await createClient()
        const { data } = await supabase
            .from('sync_logs')
            .select('*')
            .eq('product_id', importId)
            .single()

        if (data) {
            const status: ImportStatusData = {
                status: this.mapDBStatusToImportStatus(data.status),
                startedAt: data.created_at,
                completedAt: data.updated_at !== data.created_at ? data.updated_at : undefined,
                errorMessage: data.status === 'error' ? data.message : undefined,
                lastChecked: new Date().toISOString()
            }

            this.statusCache.set(importId, status)
            return status
        }

        return this.statusCache.get(importId)!
    }

    private async getProgressData(): Promise<ImportProgress> {
        const supabase = await createClient()
        const clerkUserId = await getClerkUserId()

        const [
            { count: totalProducts },
            { data: channelMappings }
        ] = await Promise.all([
            supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('clerk_user_id', clerkUserId),
            supabase
                .from('channel_mappings')
                .select('sync_status, error_message')
                .eq('platform', 'shopify')
        ])

        const imported = channelMappings?.filter(m => m.sync_status === 'success')?.length || 0
        const errors = channelMappings
            ?.filter(m => m.sync_status === 'error' && m.error_message)
            ?.map(m => m.error_message!)
            ?.slice(0, 5) || []

        return {
            imported,
            total: totalProducts || 0,
            errors
        }
    }

    private mapDBStatusToImportStatus(dbStatus: string): ImportStatus {
        switch (dbStatus) {
            case 'pending': return 'pending'
            case 'processing': return 'importing'
            case 'success': return 'completed'
            case 'error': return 'error'
            default: return 'idle'
        }
    }
}

export const importService = ImportService.getInstance() 