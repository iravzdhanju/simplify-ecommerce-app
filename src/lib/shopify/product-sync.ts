import { ShopifyGraphQLClient } from './client'
import {
  CREATE_PRODUCT_MUTATION,
  UPDATE_PRODUCT_MUTATION,
  DELETE_PRODUCT_MUTATION,
  GET_PRODUCT_BY_ID_QUERY,
  SET_METAFIELDS_MUTATION,
  CREATE_PRODUCT_MEDIA_MUTATION,
  CREATE_STAGED_UPLOADS_MUTATION
} from './queries'
import {
  updateSyncStatus,
  logSyncOperation,
  upsertChannelMapping
} from '@/lib/supabase/sync'
import { getUserProduct } from '@/lib/supabase/products'
import {
  Platform,
  SyncStatus,
  SyncOperation,
  LogStatus,
  Product,
  ShopifyCredentials
} from '@/types/database'
import { createClient } from '@/lib/supabase/server'

interface ShopifyProductData {
  product: {
    title: string
    description?: string
    productType?: string
    vendor?: string
    tags?: string[]
    status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
    options?: Array<{
      name: string
      values: string[]
    }>
    variants?: Array<{
      price: string
      compareAtPrice?: string
      sku?: string
      barcode?: string
      inventoryQuantity?: number
      weight?: number
      weightUnit?: string
      requiresShipping?: boolean
      taxable?: boolean
      inventoryPolicy?: 'DENY' | 'CONTINUE'
      options?: Array<{
        name: string
        value: string
      }>
    }>
    seo?: {
      title?: string
      description?: string
    }
    metafields?: Array<{
      namespace: string
      key: string
      value: string
      type: string
    }>
  }
}

interface SyncResult {
  success: boolean
  externalId?: string
  error?: string
  data?: any
}

/**
 * Shopify Product Sync Service
 * Handles bidirectional product synchronization with comprehensive error handling
 */
export class ShopifyProductSync {
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
   * Sync product to Shopify (create or update)
   */
  async syncProductToShopify(
    productId: string,
    operation: SyncOperation = SyncOperation.CREATE
  ): Promise<SyncResult> {
    const startTime = Date.now()

    try {
      // Update sync status to syncing
      await updateSyncStatus(productId, Platform.SHOPIFY, SyncStatus.SYNCING)

      // Get product from Supabase
      const product = await getUserProduct(productId)
      if (!product) {
        throw new Error('Product not found')
      }

      let result: SyncResult

      switch (operation) {
        case SyncOperation.CREATE:
          result = await this.createShopifyProduct(product)
          break
        case SyncOperation.UPDATE:
          result = await this.updateShopifyProduct(product)
          break
        case SyncOperation.DELETE:
          result = await this.deleteShopifyProduct(product)
          break
        default:
          throw new Error(`Unsupported operation: ${operation}`)
      }

      if (result.success) {
        // Update channel mapping with success
        await upsertChannelMapping(productId, Platform.SHOPIFY, {
          external_id: result.externalId,
          sync_status: SyncStatus.SUCCESS,
          sync_data: result.data,
        })

        // Log successful operation
        await logSyncOperation(
          productId,
          Platform.SHOPIFY,
          operation,
          LogStatus.SUCCESS,
          {
            message: `Product ${operation}d successfully on Shopify`,
            responseData: result.data,
            executionTime: Date.now() - startTime,
          }
        )
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Update sync status to error
      await updateSyncStatus(productId, Platform.SHOPIFY, SyncStatus.ERROR, undefined, errorMessage)

      // Log failed operation
      await logSyncOperation(
        productId,
        Platform.SHOPIFY,
        operation,
        LogStatus.ERROR,
        {
          message: errorMessage,
          executionTime: Date.now() - startTime,
        }
      )

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Create new product in Shopify
   */
  private async createShopifyProduct(product: Product): Promise<SyncResult> {
    const { productData, mediaData } = this.transformProductForShopify(product)

    const result = await this.client.executeQuery(
      CREATE_PRODUCT_MUTATION,
      {
        product: productData,
        media: mediaData
      }
    )

    if (result.productCreate.userErrors.length > 0) {
      const error = result.productCreate.userErrors[0]
      throw new Error(`Shopify API error: ${error.message}`)
    }

    const createdProduct = result.productCreate.product

    // Set app-specific metafields
    await this.setProductMetafields(createdProduct.id, {
      'sync_source': 'supabase',
      'original_id': product.id,
      'last_sync': new Date().toISOString(),
    })

    return {
      success: true,
      externalId: createdProduct.id,
      data: createdProduct,
    }
  }

  /**
   * Update existing product in Shopify
   */
  private async updateShopifyProduct(product: Product): Promise<SyncResult> {
    // Get external ID from channel mapping
    const channelMapping = await this.getChannelMapping(product.id)
    if (!channelMapping?.external_id) {
      throw new Error('No external ID found for product, cannot update')
    }

    const { productData } = this.transformProductForShopify(product)
    productData.id = channelMapping.external_id

    const result = await this.client.executeQuery(
      UPDATE_PRODUCT_MUTATION,
      { input: { ...productData } }
    )

    if (result.productUpdate.userErrors.length > 0) {
      const error = result.productUpdate.userErrors[0]
      throw new Error(`Shopify API error: ${error.message}`)
    }

    const updatedProduct = result.productUpdate.product

    // Update metafields
    await this.setProductMetafields(updatedProduct.id, {
      'last_sync': new Date().toISOString(),
    })

    return {
      success: true,
      externalId: updatedProduct.id,
      data: updatedProduct,
    }
  }

  /**
   * Delete product from Shopify
   */
  private async deleteShopifyProduct(product: Product): Promise<SyncResult> {
    const channelMapping = await this.getChannelMapping(product.id)
    if (!channelMapping?.external_id) {
      throw new Error('No external ID found for product, cannot delete')
    }

    const result = await this.client.executeQuery(
      DELETE_PRODUCT_MUTATION,
      { input: { id: channelMapping.external_id } }
    )

    if (result.productDelete.userErrors.length > 0) {
      const error = result.productDelete.userErrors[0]
      throw new Error(`Shopify API error: ${error.message} (${error.code})`)
    }

    return {
      success: true,
      externalId: result.productDelete.deletedProductId,
      data: { deleted: true },
    }
  }

  /**
 * Transform Supabase product to Shopify ProductCreateInput format
 */
  private transformProductForShopify(product: Product): {
    productData: any;
    mediaData?: any[];
  } {
    // Create product options if they exist (from our form's options field)
    const productOptions: Array<{
      name: string;
      values: Array<{ name: string }>;
    }> = [];

    // For now, create a basic structure - this would be enhanced based on actual product variants
    // You would typically derive this from the product's variants and options data

    const productData = {
      title: product.title,
      description: product.description || '',
      descriptionHtml: product.description || '',
      productType: product.category || '',
      vendor: product.brand || '',
      tags: product.tags || [],
      status: this.mapProductStatus(product.status),
      productOptions: productOptions,
      seo: {
        title: product.title,
        description: product.description || '',
      },
    };

    // Create media data for images
    const mediaData = product.images?.map(imageUrl => ({
      originalSource: imageUrl,
      mediaContentType: 'IMAGE' as const,
    })) || [];

    return {
      productData,
      mediaData: mediaData.length > 0 ? mediaData : undefined
    };
  }

  /**
   * Map product status from Supabase to Shopify
   */
  private mapProductStatus(status: string): 'ACTIVE' | 'DRAFT' | 'ARCHIVED' {
    switch (status) {
      case 'active':
        return 'ACTIVE'
      case 'inactive':
        return 'ARCHIVED'
      case 'draft':
        return 'DRAFT'
      default:
        return 'DRAFT'
    }
  }

  /**
   * Upload product images to Shopify
   */
  private async uploadProductImages(productId: string, imageUrls: string[]): Promise<void> {
    const mediaInputs = imageUrls.map(url => ({
      originalSource: url,
      alt: 'Product image',
    }))

    const result = await this.client.executeQuery(
      CREATE_PRODUCT_MEDIA_MUTATION,
      {
        productId,
        media: mediaInputs,
      }
    )

    if (result.productCreateMedia.mediaUserErrors.length > 0) {
      const error = result.productCreateMedia.mediaUserErrors[0]
      console.warn(`Failed to upload some images: ${error.message}`)
    }
  }

  /**
   * Set app-specific metafields on Shopify product
   */
  private async setProductMetafields(
    productId: string,
    metafields: Record<string, string>
  ): Promise<void> {
    const metafieldInputs = Object.entries(metafields).map(([key, value]) => ({
      ownerId: productId,
      namespace: '$app:sync',
      key,
      value,
      type: 'single_line_text_field',
    }))

    const result = await this.client.executeQuery(
      SET_METAFIELDS_MUTATION,
      { metafields: metafieldInputs }
    )

    if (result.metafieldsSet.userErrors.length > 0) {
      const error = result.metafieldsSet.userErrors[0]
      console.warn(`Failed to set metafields: ${error.message}`)
    }
  }

  /**
   * Get channel mapping for product
   */
  private async getChannelMapping(productId: string) {
    // This would use our existing Supabase function
    // For now, simplified implementation
    const supabase = await createClient()

    const { data } = await supabase
      .from('channel_mappings')
      .select('*')
      .eq('product_id', productId)
      .eq('platform', Platform.SHOPIFY)
      .single()

    return data
  }

  /**
   * Import product from Shopify to Supabase
   */
  async importProductFromShopify(shopifyProductId: string): Promise<SyncResult> {
    try {
      const result = await this.client.executeQuery(
        GET_PRODUCT_BY_ID_QUERY,
        { id: shopifyProductId }
      )

      if (!result.product) {
        throw new Error('Product not found in Shopify')
      }

      const shopifyProduct = result.product
      const supabaseProduct = this.transformShopifyProductToSupabase(shopifyProduct)

      // Create product in Supabase
      const { createProduct } = await import('@/lib/supabase/products')
      const createdProduct = await createProduct(supabaseProduct)

      // Create channel mapping
      await upsertChannelMapping(createdProduct.id, Platform.SHOPIFY, {
        external_id: shopifyProductId,
        sync_status: SyncStatus.SUCCESS,
        sync_data: shopifyProduct,
      })

      return {
        success: true,
        externalId: shopifyProductId,
        data: createdProduct,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Transform Shopify product to Supabase format
   */
  private transformShopifyProductToSupabase(shopifyProduct: any): any {
    const firstVariant = shopifyProduct.variants.edges[0]?.node

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
      status: this.mapShopifyStatusToSupabase(shopifyProduct.status),
      images: shopifyProduct.images.edges.map((edge: any) => edge.node.url),
    }
  }

  /**
   * Map Shopify status to Supabase status
   */
  private mapShopifyStatusToSupabase(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'active'
      case 'ARCHIVED':
        return 'inactive'
      case 'DRAFT':
        return 'draft'
      default:
        return 'draft'
    }
  }
}