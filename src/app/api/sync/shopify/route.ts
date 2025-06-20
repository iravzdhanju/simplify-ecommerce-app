import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { getUserProduct } from '@/lib/supabase/products'
import {
  upsertChannelMapping,
  updateSyncStatus,
  logSyncOperation
} from '@/lib/supabase/sync'
import { getActiveShopifyConnections } from '@/lib/supabase/platform-connections'
import { Platform, SyncStatus, SyncOperation, LogStatus } from '@/types/database'
import { z } from 'zod'

const syncProductSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  connectionId: z.string().uuid('Invalid connection ID').optional(),
  operation: z.enum(['create', 'update', 'delete']).default('create'),
})

/**
 * POST /api/sync/shopify
 * Sync a product to Shopify
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    requireAuth()

    const body = await req.json()
    const { productId, connectionId, operation } = syncProductSchema.parse(body)

    // Get the product
    const product = await getUserProduct(productId)
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Get Shopify connections
    console.log('Getting active Shopify connections...')
    const connections = await getActiveShopifyConnections()
    console.log(`Found ${connections.length} Shopify connections:`, connections)

    if (connections.length === 0) {
      console.error('No active Shopify connections found')
      await logSyncOperation(
        productId,
        Platform.SHOPIFY,
        operation as SyncOperation,
        LogStatus.ERROR,
        {
          message: 'No active Shopify connections found',
          executionTime: Date.now() - startTime,
        }
      )

      return NextResponse.json(
        {
          success: false,
          error: 'No active Shopify connections found. Please set up a Shopify connection first.',
          details: 'Go to Dashboard > Connections to add a Shopify store connection.'
        },
        { status: 400 }
      )
    }

    // Use specific connection or first available
    const connection = connectionId
      ? connections.find(c => c.id === connectionId)
      : connections[0]

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'Shopify connection not found' },
        { status: 404 }
      )
    }

    // Update sync status to syncing
    await updateSyncStatus(productId, Platform.SHOPIFY, SyncStatus.SYNCING)

    // Transform product data for Shopify
    const shopifyProductData = transformProductForShopify(product)

    try {
      console.log(`Syncing product ${productId} with connection:`, {
        id: connection.id,
        name: connection.connection_name,
        platform: connection.platform,
        hasCredentials: !!connection.credentials
      })

      // Use the enhanced Shopify sync
      const syncResult = await syncProductToShopify(
        productId,
        connection.credentials,
        operation as SyncOperation
      )

      console.log('Sync result:', syncResult)

      // Update channel mapping with external ID and success status
      await upsertChannelMapping(productId, Platform.SHOPIFY, {
        external_id: syncResult.externalId,
        sync_status: SyncStatus.SUCCESS,
        sync_data: syncResult.responseData,
      })

      // Log successful operation
      await logSyncOperation(
        productId,
        Platform.SHOPIFY,
        operation as SyncOperation,
        LogStatus.SUCCESS,
        {
          message: `Product ${operation}d successfully on Shopify`,
          requestData: shopifyProductData,
          responseData: syncResult.responseData,
          executionTime: Date.now() - startTime,
        }
      )

      return NextResponse.json({
        success: true,
        data: {
          productId,
          platform: Platform.SHOPIFY,
          operation,
          externalId: syncResult.externalId,
          syncStatus: SyncStatus.SUCCESS,
        },
      })

    } catch (syncError) {
      const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown sync error'

      // Update sync status to error
      await updateSyncStatus(productId, Platform.SHOPIFY, SyncStatus.ERROR, undefined, errorMessage)

      // Log failed operation
      await logSyncOperation(
        productId,
        Platform.SHOPIFY,
        operation as SyncOperation,
        LogStatus.ERROR,
        {
          message: errorMessage,
          requestData: shopifyProductData,
          executionTime: Date.now() - startTime,
        }
      )

      return NextResponse.json(
        {
          success: false,
          error: `Shopify sync failed: ${errorMessage}`,
          productId,
          platform: Platform.SHOPIFY,
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('POST /api/sync/shopify error:', error)

    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to sync product to Shopify' },
      { status: 500 }
    )
  }
}

/**
 * Transform product data for Shopify API format
 */
function transformProductForShopify(product: any) {
  return {
    product: {
      title: product.title,
      body_html: product.description || '',
      vendor: product.brand || '',
      product_type: product.category || '',
      tags: product.tags?.join(',') || '',
      status: product.status === 'active' ? 'active' : 'draft',
      variants: [{
        price: product.price?.toString() || '0.00',
        inventory_quantity: product.inventory || 0,
        sku: product.sku || '',
        weight: product.weight || 0,
        weight_unit: 'kg',
        requires_shipping: true,
      }],
      images: (product.images || []).map((url: string) => ({ src: url })),
    }
  }
}

/**
 * Sync product to Shopify using the new GraphQL client
 */
async function syncProductToShopify(
  productId: string,
  credentials: any,
  operation: SyncOperation
): Promise<{ externalId: string; responseData: any }> {
  const { ShopifyProductSync } = await import('@/lib/shopify/product-sync')

  // Create Shopify sync client
  const shopifySync = new ShopifyProductSync({
    shop_domain: credentials.shop_domain,
    access_token: credentials.access_token,
    scope: credentials.scope || 'write_products,read_products',
  })

  // Use the productId from the request parameters
  const result = await shopifySync.syncProductToShopify(productId, operation)

  if (!result.success) {
    throw new Error(result.error || 'Sync operation failed')
  }

  return {
    externalId: result.externalId!,
    responseData: result.data,
  }
}