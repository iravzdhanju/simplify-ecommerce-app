import { Platform } from '@/types/database'
import { logSyncOperation, updateSyncStatus } from '@/lib/supabase/sync'
import { LogStatus, SyncOperation, SyncStatus } from '@/types/database'

interface ShopifyConfig {
  shopDomain: string
  accessToken: string
  apiVersion?: string
}

interface RateLimitInfo {
  currentCost: number
  maxCost: number
  pointsPerSecond: number
  burstCapacity: number
  lastRefill: number
}

/**
 * Modern Shopify GraphQL Admin API Client
 * Implements cost-based rate limiting and intelligent retry logic
 */
export class ShopifyGraphQLClient {
  private config: ShopifyConfig
  private rateLimiter: ShopifyRateLimiter
  private apiVersion: string

  constructor(config: ShopifyConfig) {
    this.config = config
    this.apiVersion = config.apiVersion || '2025-01'
    this.rateLimiter = new ShopifyRateLimiter(config.shopDomain)
  }

  /**
   * Execute GraphQL query with automatic rate limiting and error handling
   */
  async executeQuery<T = any>(
    query: string, 
    variables?: any,
    operationName?: string
  ): Promise<T> {
    const estimatedCost = this.estimateQueryCost(query, variables)
    
    // Wait for rate limit capacity
    await this.rateLimiter.waitForCapacity(estimatedCost)
    
    const startTime = Date.now()
    
    try {
      const response = await fetch(
        `https://${this.config.shopDomain}/admin/api/${this.apiVersion}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': this.config.accessToken,
          },
          body: JSON.stringify({
            query,
            variables,
            operationName,
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Update rate limiter with actual cost
      if (data.extensions?.cost) {
        this.rateLimiter.updateActualCost(data.extensions.cost)
      }

      // Handle GraphQL errors
      if (data.errors && data.errors.length > 0) {
        const error = data.errors[0]
        const errorCode = error.extensions?.code

        switch (errorCode) {
          case 'THROTTLED':
            await this.handleThrottleError(error.extensions.cost)
            throw new ShopifyThrottleError(error.message, error.extensions.cost)
          case 'UNAUTHENTICATED':
            throw new ShopifyAuthError('Invalid access token')
          case 'MAX_COST_EXCEEDED':
            throw new ShopifyCostError(error.message, error.extensions.cost, error.extensions.maxCost)
          default:
            throw new ShopifyGraphQLError(error.message, errorCode)
        }
      }

      return data.data
    } catch (error) {
      const executionTime = Date.now() - startTime
      console.error('GraphQL query failed:', {
        error: error.message,
        query: query.substring(0, 200),
        variables,
        executionTime,
      })
      throw error
    }
  }

  /**
   * Execute bulk operation with monitoring
   */
  async executeBulkOperation(query: string): Promise<BulkOperationResult> {
    const mutation = `
      mutation bulkOperationRunQuery($query: String!) {
        bulkOperationRunQuery(query: $query) {
          bulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
            objectCount
            fileSize
            url
            partialDataUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const result = await this.executeQuery(mutation, { query })
    
    if (result.bulkOperationRunQuery.userErrors.length > 0) {
      throw new Error(`Bulk operation failed: ${result.bulkOperationRunQuery.userErrors[0].message}`)
    }

    const operationId = result.bulkOperationRunQuery.bulkOperation.id
    return this.monitorBulkOperation(operationId)
  }

  /**
   * Monitor bulk operation until completion
   */
  private async monitorBulkOperation(operationId: string): Promise<BulkOperationResult> {
    const query = `
      query getBulkOperation($id: ID!) {
        node(id: $id) {
          ... on BulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
            objectCount
            fileSize
            url
            partialDataUrl
          }
        }
      }
    `

    while (true) {
      const result = await this.executeQuery(query, { id: operationId })
      const operation = result.node

      if (operation.status === 'COMPLETED') {
        return {
          id: operation.id,
          status: operation.status,
          url: operation.url,
          objectCount: operation.objectCount,
          fileSize: operation.fileSize,
        }
      }

      if (operation.status === 'FAILED' || operation.status === 'CANCELED') {
        throw new Error(`Bulk operation ${operation.status.toLowerCase()}: ${operation.errorCode}`)
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  /**
   * Estimate query cost for rate limiting
   */
  private estimateQueryCost(query: string, variables?: any): number {
    // Basic cost estimation - in production, use more sophisticated analysis
    const fieldCount = (query.match(/\w+/g) || []).length
    const connectionCount = (query.match(/\(\s*first:\s*\d+/g) || []).length
    
    return Math.max(1, fieldCount + (connectionCount * 10))
  }

  private async handleThrottleError(cost: number): Promise<void> {
    const waitTime = Math.ceil(cost / this.rateLimiter.pointsPerSecond) * 1000
    console.warn(`Rate limited, waiting ${waitTime}ms`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }
}

/**
 * Shopify rate limiter implementing cost-based token bucket algorithm
 */
class ShopifyRateLimiter {
  private shopDomain: string
  private pointsPerSecond: number
  private burstCapacity: number
  private currentCost: number
  private lastRefill: number

  constructor(shopDomain: string, plan: 'standard' | 'plus' = 'standard') {
    this.shopDomain = shopDomain
    this.pointsPerSecond = plan === 'plus' ? 100 : 50
    this.burstCapacity = plan === 'plus' ? 2000 : 1000
    this.currentCost = 0
    this.lastRefill = Date.now()
  }

  async waitForCapacity(estimatedCost: number): Promise<void> {
    this.refillBucket()

    if (this.currentCost + estimatedCost > this.burstCapacity) {
      const waitTime = Math.ceil((this.currentCost + estimatedCost - this.burstCapacity) / this.pointsPerSecond) * 1000
      await new Promise(resolve => setTimeout(resolve, waitTime))
      this.refillBucket()
    }

    this.currentCost += estimatedCost
  }

  updateActualCost(actualCost: number): void {
    // Adjust based on actual vs estimated cost
    this.currentCost = Math.max(0, this.currentCost + actualCost.actualQueryCost - actualCost.estimatedCost || 0)
  }

  private refillBucket(): void {
    const now = Date.now()
    const timePassed = (now - this.lastRefill) / 1000
    const pointsToAdd = timePassed * this.pointsPerSecond

    this.currentCost = Math.max(0, this.currentCost - pointsToAdd)
    this.lastRefill = now
  }

  get pointsPerSecond(): number {
    return this.pointsPerSecond
  }
}

// Custom error classes
export class ShopifyError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'ShopifyError'
  }
}

export class ShopifyGraphQLError extends ShopifyError {
  constructor(message: string, code?: string) {
    super(message, code)
    this.name = 'ShopifyGraphQLError'
  }
}

export class ShopifyAuthError extends ShopifyError {
  constructor(message: string) {
    super(message, 'UNAUTHENTICATED')
    this.name = 'ShopifyAuthError'
  }
}

export class ShopifyThrottleError extends ShopifyError {
  constructor(message: string, public cost: number) {
    super(message, 'THROTTLED')
    this.name = 'ShopifyThrottleError'
  }
}

export class ShopifyCostError extends ShopifyError {
  constructor(message: string, public cost: number, public maxCost: number) {
    super(message, 'MAX_COST_EXCEEDED')
    this.name = 'ShopifyCostError'
  }
}

// Type definitions
interface BulkOperationResult {
  id: string
  status: string
  url: string
  objectCount: number
  fileSize: number
}