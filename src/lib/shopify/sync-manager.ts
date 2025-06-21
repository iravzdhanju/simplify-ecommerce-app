import { ShopifyProductSync } from './product-sync'
import { ShopifyBulkSync } from './bulk-sync'
import { ShopifyGraphQLClient } from './client'
import { 
  getActiveShopifyConnections, 
  PlatformConnection 
} from '@/lib/supabase/platform-connections'
import { 
  getProductsWithSyncStatus
} from '@/lib/supabase/products'
import { 
  logSyncOperation, 
  updateSyncStatus,
  getUserSyncLogs,
  getUserSyncStats,
  getProductsNeedingSync
} from '@/lib/supabase/sync'
import { 
  Platform, 
  SyncStatus, 
  SyncOperation, 
  LogStatus,
  ShopifyCredentials,
  Product
} from '@/types/database'

export interface SyncStats {
  totalProducts: number
  syncedProducts: number
  pendingProducts: number
  errorProducts: number
  lastSyncTime: string | null
}

export interface SyncResult {
  success: boolean
  totalProcessed: number
  successful: number
  failed: number
  errors: string[]
  processingTime: number
}

/**
 * Comprehensive Shopify Sync Manager
 * Handles all aspects of 2-way product synchronization
 */
export class ShopifySyncManager {
  private connections: PlatformConnection[] = []
  private initialized = false

  constructor() {}

  /**
   * Initialize the sync manager with user's Shopify connections
   */
  async initialize(): Promise<void> {
    try {
      this.connections = await getActiveShopifyConnections()
      this.initialized = true
    } catch (error) {
      console.warn('Failed to initialize sync manager:', error)
      this.connections = []
      this.initialized = true
    }
  }

  /**
   * Get sync statistics for the user
   */
  async getSyncStats(): Promise<SyncStats> {
    if (!this.initialized) await this.initialize()

    const [products, stats] = await Promise.all([
      getProductsWithSyncStatus(),
      getUserSyncStats()
    ])

    const syncedProducts = products.filter(p => 
      p.channel_mappings?.some(m => m.sync_status === SyncStatus.SUCCESS)
    ).length

    const pendingProducts = products.filter(p => 
      p.channel_mappings?.some(m => m.sync_status === SyncStatus.PENDING)
    ).length

    const errorProducts = products.filter(p => 
      p.channel_mappings?.some(m => m.sync_status === SyncStatus.ERROR)
    ).length

    return {
      totalProducts: products.length,
      syncedProducts,
      pendingProducts,
      errorProducts,
      lastSyncTime: stats.lastSyncTime
    }
  }

  /**
   * Perform full import of all products from Shopify stores
   */
  async performFullImport(connectionId?: string): Promise<SyncResult> {
    if (!this.initialized) await this.initialize()

    if (this.connections.length === 0) {
      throw new Error('No active Shopify connections found')
    }

    const connection = connectionId 
      ? this.connections.find(c => c.id === connectionId)
      : this.connections[0]

    if (!connection) {
      throw new Error('Shopify connection not found')
    }

    const bulkSync = new ShopifyBulkSync(connection.credentials as ShopifyCredentials)
    const result = await bulkSync.performFullProductImport()

    return {
      success: result.failedImports === 0,
      totalProcessed: result.totalProducts,
      successful: result.successfulImports,
      failed: result.failedImports,
      errors: result.errors,
      processingTime: result.processingTime
    }
  }

  /**
   * Perform incremental sync for recently updated products
   */
  async performIncrementalSync(since?: Date, connectionId?: string): Promise<SyncResult> {
    if (!this.initialized) await this.initialize()

    if (this.connections.length === 0) {
      throw new Error('No active Shopify connections found')
    }

    const connection = connectionId 
      ? this.connections.find(c => c.id === connectionId)
      : this.connections[0]

    if (!connection) {
      throw new Error('Shopify connection not found')
    }

    const bulkSync = new ShopifyBulkSync(connection.credentials as ShopifyCredentials)
    const result = await bulkSync.performIncrementalSync(since)

    return {
      success: result.failedImports === 0,
      totalProcessed: result.totalProducts,
      successful: result.successfulImports,
      failed: result.failedImports,
      errors: result.errors,
      processingTime: result.processingTime
    }
  }

  /**
   * Sync a single product to Shopify
   */
  async syncProductToShopify(
    productId: string, 
    operation: SyncOperation = SyncOperation.CREATE,
    connectionId?: string
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    if (!this.initialized) await this.initialize()

    if (this.connections.length === 0) {
      throw new Error('No active Shopify connections found')
    }

    const connection = connectionId 
      ? this.connections.find(c => c.id === connectionId)
      : this.connections[0]

    if (!connection) {
      throw new Error('Shopify connection not found')
    }

    const productSync = new ShopifyProductSync(connection.credentials as ShopifyCredentials)
    return await productSync.syncProductToShopify(productId, operation)
  }

  /**
   * Sync multiple products to Shopify in batches
   */
  async syncMultipleProductsToShopify(
    productIds: string[],
    operation: SyncOperation = SyncOperation.CREATE,
    connectionId?: string,
    batchSize: number = 5
  ): Promise<SyncResult> {
    if (!this.initialized) await this.initialize()

    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      totalProcessed: productIds.length,
      successful: 0,
      failed: 0,
      errors: [],
      processingTime: 0
    }

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (productId) => {
        try {
          const syncResult = await this.syncProductToShopify(productId, operation, connectionId)
          if (syncResult.success) {
            result.successful++
          } else {
            result.failed++
            result.errors.push(`Product ${productId}: ${syncResult.error}`)
          }
        } catch (error) {
          result.failed++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          result.errors.push(`Product ${productId}: ${errorMessage}`)
        }
      })

      await Promise.allSettled(batchPromises)
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < productIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    result.success = result.failed === 0
    result.processingTime = Date.now() - startTime

    return result
  }

  /**
   * Sync all pending products to Shopify
   */
  async syncPendingProducts(connectionId?: string): Promise<SyncResult> {
    const pendingProducts = await getProductsNeedingSync(Platform.SHOPIFY)
    const productIds = pendingProducts.map(p => p.product_id)

    if (productIds.length === 0) {
      return {
        success: true,
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        errors: [],
        processingTime: 0
      }
    }

    return await this.syncMultipleProductsToShopify(
      productIds, 
      SyncOperation.UPDATE, 
      connectionId
    )
  }

  /**
   * Import a single product from Shopify by external ID
   */
  async importProductFromShopify(
    shopifyProductId: string,
    connectionId?: string
  ): Promise<{ success: boolean; productId?: string; error?: string }> {
    if (!this.initialized) await this.initialize()

    if (this.connections.length === 0) {
      throw new Error('No active Shopify connections found')
    }

    const connection = connectionId 
      ? this.connections.find(c => c.id === connectionId)
      : this.connections[0]

    if (!connection) {
      throw new Error('Shopify connection not found')
    }

    const productSync = new ShopifyProductSync(connection.credentials as ShopifyCredentials)
    const result = await productSync.importProductFromShopify(shopifyProductId)

    return {
      success: result.success,
      productId: result.data?.id,
      error: result.error
    }
  }

  /**
   * Get recent sync activity
   */
  async getRecentSyncActivity(limit: number = 50) {
    return await getUserSyncLogs(limit)
  }

  /**
   * Test connection to a Shopify store
   */
  async testConnection(connectionId?: string): Promise<{ success: boolean; error?: string; shopInfo?: any }> {
    if (!this.initialized) await this.initialize()

    const connection = connectionId 
      ? this.connections.find(c => c.id === connectionId)
      : this.connections[0]

    if (!connection) {
      return { success: false, error: 'Shopify connection not found' }
    }

    try {
      const client = new ShopifyGraphQLClient({
        shopDomain: (connection.credentials as ShopifyCredentials).shop_domain,
        accessToken: (connection.credentials as ShopifyCredentials).access_token,
      })

      const shopInfo = await client.executeQuery(`
        query {
          shop {
            id
            name
            email
            domain
            myshopifyDomain
            currencyCode
            plan {
              displayName
            }
          }
        }
      `)

      return {
        success: true,
        shopInfo: shopInfo.shop
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Schedule automatic sync operations
   */
  async scheduleAutomaticSync(connectionId?: string): Promise<void> {
    // This would implement scheduled sync operations
    // For now, just perform an incremental sync
    await this.performIncrementalSync(
      new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      connectionId
    )
  }

  /**
   * Get sync health status
   */
  async getSyncHealth(): Promise<{
    status: 'healthy' | 'warning' | 'error'
    message: string
    details: any
  }> {
    try {
      const stats = await this.getSyncStats()
      const errorRate = stats.totalProducts > 0 ? stats.errorProducts / stats.totalProducts : 0

      if (errorRate > 0.1) { // More than 10% errors
        return {
          status: 'error',
          message: `High error rate: ${Math.round(errorRate * 100)}% of products have sync errors`,
          details: stats
        }
      }

      if (errorRate > 0.05) { // More than 5% errors
        return {
          status: 'warning',
          message: `Some sync errors detected: ${Math.round(errorRate * 100)}% of products have issues`,
          details: stats
        }
      }

      return {
        status: 'healthy',
        message: 'All syncs are working properly',
        details: stats
      }
    } catch (error) {
      return {
        status: 'error',
        message: 'Unable to determine sync health',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }
}

// Export singleton instance
export const shopifySyncManager = new ShopifySyncManager()