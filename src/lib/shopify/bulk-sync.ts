import { ShopifyGraphQLClient } from './client'
import { BULK_PRODUCTS_QUERY } from './queries'
import { createProduct } from '@/lib/supabase/products'
import { upsertChannelMapping } from '@/lib/supabase/sync'
import { getClerkUserId } from '@/lib/supabase/auth'
import { Platform, SyncStatus, ShopifyCredentials, Json } from '@/types/database'

interface BulkSyncResult {
  totalProducts: number
  successfulImports: number
  failedImports: number
  errors: string[]
  processingTime: number
}

interface ShopifyBulkProduct {
  id: string
  title: string
  handle: string
  description: string
  productType: string
  vendor: string
  tags: string[]
  status: string
  createdAt: string
  updatedAt: string
  totalInventory: number
  variants: ShopifyBulkVariant[]
  images: ShopifyBulkImage[]
  metafields: ShopifyBulkMetafield[]
}

interface ShopifyBulkVariant {
  id: string
  title: string
  price: string
  compareAtPrice?: string
  inventoryQuantity: number
  sku: string
  barcode?: string

  selectedOptions: Array<{
    name: string
    value: string
  }>
  inventoryItem: {
    id: string
    tracked: boolean
    measurement?: {
      weight?: {
        value: number
        unit: string
      }
    }
  }
}

interface ShopifyBulkImage {
  url: string
  altText?: string
  width: number
  height: number
}

interface ShopifyBulkMetafield {
  namespace: string
  key: string
  value: string
  type: string
}

/**
 * Shopify Bulk Sync Manager
 * Handles efficient large-scale product imports using Shopify's bulk operations
 */
export class ShopifyBulkSync {
  private client: ShopifyGraphQLClient
  private credentials: ShopifyCredentials

  constructor(credentials: ShopifyCredentials) {
    this.credentials = credentials
    this.client = new ShopifyGraphQLClient({
      shopDomain: credentials.shop_domain,
      accessToken: credentials.access_token,
    })
  }

  /**
   * Perform full product import from Shopify
   */
  async performFullProductImport(): Promise<BulkSyncResult> {
    const startTime = Date.now()
    const result: BulkSyncResult = {
      totalProducts: 0,
      successfulImports: 0,
      failedImports: 0,
      errors: [],
      processingTime: 0,
    }

    try {
      console.log('Starting bulk product import from Shopify...')

      // Check if we have valid credentials first
      if (!this.credentials.access_token || !this.credentials.shop_domain) {
        throw new Error('Invalid Shopify credentials: Missing access token or shop domain')
      }

      // Start bulk operation
      const bulkOperation = await this.client.executeBulkOperation(BULK_PRODUCTS_QUERY)

      console.log(`Bulk operation completed. Processing ${bulkOperation.objectCount} objects...`)

      // Download and process results
      const products = await this.downloadBulkResults(bulkOperation.url)
      result.totalProducts = products.length

      // Process products in batches
      const batchSize = 10
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize)
        const batchResults = await this.processBatch(batch)

        result.successfulImports += batchResults.successful
        result.failedImports += batchResults.failed
        result.errors.push(...batchResults.errors)

        // Log progress
        const processed = Math.min(i + batchSize, products.length)
        console.log(`Processed ${processed}/${products.length} products`)
      }

      result.processingTime = Date.now() - startTime

      console.log('Bulk import completed:', {
        total: result.totalProducts,
        successful: result.successfulImports,
        failed: result.failedImports,
        time: `${result.processingTime}ms`,
      })

      return result
    } catch (error) {
      console.error('Bulk import failed:', error)
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      result.processingTime = Date.now() - startTime
      return result
    }
  }

  /**
   * Perform incremental sync for recently updated products
   */
  async performIncrementalSync(since?: Date): Promise<BulkSyncResult> {
    const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000) // Default: last 24 hours

    const incrementalQuery = `
      {
        products(query: "updated_at:>='${sinceDate.toISOString()}'") {
          edges {
            node {
              id
              title
              handle
              description
              productType
              vendor
              tags
              status
              createdAt
              updatedAt
              totalInventory
              variants {
                edges {
                  node {
                    id
                    title
                    price
                    compareAtPrice
                    inventoryQuantity
                    sku
                    barcode
                    inventoryItem {
                      id
                      tracked
                      measurement {
                        weight {
                          value
                          unit
                        }
                      }
                    }
                    selectedOptions {
                      name
                      value
                    }
                    inventoryItem {
                      id
                      tracked
                    }
                  }
                }
              }
              images {
                edges {
                  node {
                    url
                    altText
                    width
                    height
                  }
                }
              }
              metafields {
                edges {
                  node {
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
          }
        }
      }
    `

    console.log(`Starting incremental sync since ${sinceDate.toISOString()}...`)

    const bulkOperation = await this.client.executeBulkOperation(incrementalQuery)
    const products = await this.downloadBulkResults(bulkOperation.url)

    // Process incrementally - update existing products or create new ones
    const result: BulkSyncResult = {
      totalProducts: products.length,
      successfulImports: 0,
      failedImports: 0,
      errors: [],
      processingTime: 0,
    }

    const startTime = Date.now()
    const batchResults = await this.processBatch(products, true) // true = allow updates

    result.successfulImports = batchResults.successful
    result.failedImports = batchResults.failed
    result.errors = batchResults.errors
    result.processingTime = Date.now() - startTime

    return result
  }

  /**
   * Download and parse bulk operation results
   */
  private async downloadBulkResults(downloadUrl: string): Promise<ShopifyBulkProduct[]> {
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Failed to download bulk results: ${response.status}`)
    }

    const jsonlData = await response.text()
    const lines = jsonlData.split('\n').filter(line => line.trim())

    console.log(`Downloaded JSONL with ${lines.length} lines`)

    // Parse JSONL format and reconstruct products
    const products = new Map<string, ShopifyBulkProduct>()
    const variants = new Map<string, ShopifyBulkVariant[]>()
    const images = new Map<string, ShopifyBulkImage[]>()
    const metafields = new Map<string, ShopifyBulkMetafield[]>()

    // Parse all objects and group by type
    let productCount = 0
    let variantCount = 0
    let imageCount = 0

    lines.forEach((line, index) => {
      try {
        const obj = JSON.parse(line)

        // Log first few objects to understand structure
        if (index < 5) {
          console.log(`Object ${index}:`, JSON.stringify(obj, null, 2))
        }

        // Identify object type by GID format instead of __typename
        if (obj.id?.includes('gid://shopify/Product/') && !obj.__parentId) {
          // This is a Product
          productCount++
          products.set(obj.id, {
            id: obj.id,
            title: obj.title,
            handle: obj.handle,
            description: obj.description || '',
            productType: obj.productType || '',
            vendor: obj.vendor || '',
            tags: obj.tags || [],
            status: obj.status,
            createdAt: obj.createdAt,
            updatedAt: obj.updatedAt,
            totalInventory: obj.totalInventory || 0,
            variants: [],
            images: [],
            metafields: [],
          })
        } else if (obj.id?.includes('gid://shopify/ProductVariant/') && obj.__parentId) {
          // This is a ProductVariant
          variantCount++
          if (!variants.has(obj.__parentId)) {
            variants.set(obj.__parentId, [])
          }
          variants.get(obj.__parentId)!.push({
            id: obj.id,
            title: obj.title,
            price: obj.price,
            compareAtPrice: obj.compareAtPrice,
            inventoryQuantity: obj.inventoryQuantity || 0,
            sku: obj.sku || '',
            barcode: obj.barcode,
            inventoryItem: {
              id: obj.inventoryItem?.id || '',
              tracked: obj.inventoryItem?.tracked || false,
              measurement: obj.inventoryItem?.measurement ? {
                weight: obj.inventoryItem.measurement.weight ? {
                  value: obj.inventoryItem.measurement.weight.value,
                  unit: obj.inventoryItem.measurement.weight.unit || 'KILOGRAMS'
                } : undefined
              } : undefined
            },
            selectedOptions: obj.selectedOptions || [],
          })
        } else if ((obj.id?.includes('gid://shopify/MediaImage/') || obj.id?.includes('gid://shopify/ImageSource/')) && obj.__parentId) {
          // This is an Image
          imageCount++
          if (!images.has(obj.__parentId)) {
            images.set(obj.__parentId, [])
          }
          images.get(obj.__parentId)!.push({
            url: obj.url,
            altText: obj.altText,
            width: obj.width || 0,
            height: obj.height || 0,
          })
        } else if (obj.id?.includes('gid://shopify/Metafield/') && obj.__parentId) {
          // This is a Metafield
          if (!metafields.has(obj.__parentId)) {
            metafields.set(obj.__parentId, [])
          }
          metafields.get(obj.__parentId)!.push({
            namespace: obj.namespace,
            key: obj.key,
            value: obj.value,
            type: obj.type,
          })
        }
      } catch (parseError) {
        console.warn('Failed to parse JSONL line:', line.substring(0, 100))
      }
    })

    console.log(`Parsed objects: ${productCount} products, ${variantCount} variants, ${imageCount} images`)

    // Reconstruct complete products
    const completeProducts: ShopifyBulkProduct[] = []
    products.forEach((product, productId) => {
      product.variants = variants.get(productId) || []
      product.images = images.get(productId) || []
      product.metafields = metafields.get(productId) || []
      completeProducts.push(product)
    })

    console.log(`Reconstructed ${completeProducts.length} complete products`)
    return completeProducts
  }

  /**
   * Process a batch of products
   */
  private async processBatch(
    products: ShopifyBulkProduct[],
    allowUpdates: boolean = false
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    const result = { successful: 0, failed: 0, errors: [] as string[] }

    const clerkUserId = await getClerkUserId()
    if (!clerkUserId) {
      throw new Error('User not authenticated')
    }

    const promises = products.map(async (shopifyProduct) => {
      try {
        // Check if product already exists
        const existingMapping = await this.findExistingMapping(shopifyProduct.id)

        if (existingMapping && !allowUpdates) {
          // Skip if product already imported and updates not allowed
          return { success: true, productId: shopifyProduct.id }
        }

        // Transform Shopify product to our format
        const supabaseProduct = this.transformShopifyProduct(shopifyProduct, clerkUserId)

        let productId: string

        if (existingMapping) {
          // Update existing product
          const { updateProduct } = await import('@/lib/supabase/products')
          const updatedProduct = await updateProduct(existingMapping.product_id, supabaseProduct)
          productId = updatedProduct.id
        } else {
          // Create new product
          const newProduct = await createProduct(supabaseProduct)
          productId = newProduct.id
        }

        // Create/update channel mapping
        await upsertChannelMapping(productId, Platform.SHOPIFY, {
          external_id: shopifyProduct.id,
          sync_status: SyncStatus.SUCCESS,
          sync_data: shopifyProduct as unknown as Json,
        })

        return { success: true, productId }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to import product ${shopifyProduct.id}:`, errorMessage)
        return { success: false, error: errorMessage, productId: shopifyProduct.id }
      }
    })

    const results = await Promise.allSettled(promises)

    results.forEach((promiseResult) => {
      if (promiseResult.status === 'fulfilled') {
        if (promiseResult.value.success) {
          result.successful++
        } else {
          result.failed++
          result.errors.push(`Product ${promiseResult.value.productId}: ${promiseResult.value.error}`)
        }
      } else {
        result.failed++
        result.errors.push(promiseResult.reason?.message || 'Promise rejected')
      }
    })

    return result
  }

  /**
   * Find existing channel mapping for a Shopify product
   */
  private async findExistingMapping(shopifyProductId: string) {
    const { createServiceRoleClient } = await import('@/lib/supabase/server')
    const supabase = createServiceRoleClient()

    const { data } = await supabase
      .from('channel_mappings')
      .select('product_id')
      .eq('platform', Platform.SHOPIFY)
      .eq('external_id', shopifyProductId)
      .single()

    return data
  }

  /**
   * Transform Shopify product to Supabase format
   */
  private transformShopifyProduct(shopifyProduct: ShopifyBulkProduct, clerkUserId: string): any {
    const firstVariant = shopifyProduct.variants[0]

    return {
      title: shopifyProduct.title,
      description: shopifyProduct.description || null,
      price: firstVariant ? parseFloat(firstVariant.price) : null,
      inventory: firstVariant?.inventoryQuantity || 0,
      sku: firstVariant?.sku || null,
      brand: shopifyProduct.vendor || null,
      category: shopifyProduct.productType || null,
      weight: firstVariant?.inventoryItem?.measurement?.weight?.value || null,
      tags: shopifyProduct.tags || [],
      status: this.mapShopifyStatus(shopifyProduct.status),
      images: shopifyProduct.images.map(img => img.url),
      created_at: shopifyProduct.createdAt,
      updated_at: shopifyProduct.updatedAt || shopifyProduct.createdAt,
      clerk_user_id: clerkUserId,
    }
  }

  /**
   * Map Shopify status to our internal status
   */
  private mapShopifyStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'active':
        return 'active'
      case 'archived':
        return 'inactive'
      case 'draft':
        return 'draft'
      default:
        return 'draft'
    }
  }
}