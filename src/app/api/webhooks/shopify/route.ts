import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { logSyncOperation, updateSyncStatus } from '@/lib/supabase/sync'
import { Platform, LogStatus, SyncStatus, SyncOperation } from '@/types/database'

const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET

if (!WEBHOOK_SECRET) {
  console.warn('SHOPIFY_WEBHOOK_SECRET is not set - webhook verification will be skipped')
}

interface ShopifyWebhookEvent {
  id: number
  title: string
  handle: string
  body_html: string
  vendor: string
  product_type: string
  tags: string
  status: string
  created_at: string
  updated_at: string
  variants: Array<{
    id: number
    title: string
    price: string
    sku: string
    inventory_quantity: number
  }>
  images: Array<{
    id: number
    src: string
    alt: string
  }>
}

/**
 * POST /api/webhooks/shopify
 * Handle Shopify webhook events for real-time sync
 */
export async function POST(req: NextRequest) {
  try {
    // Get headers
    const headersList = await headers()
    const shopifyTopic = headersList.get('x-shopify-topic')
    const shopifyShop = headersList.get('x-shopify-shop-domain')
    const shopifyHmac = headersList.get('x-shopify-hmac-sha256')
    const webhookId = headersList.get('x-shopify-webhook-id')

    if (!shopifyTopic || !shopifyShop) {
      return NextResponse.json(
        { error: 'Missing required headers' },
        { status: 400 }
      )
    }

    // Get request body
    const body = await req.text()

    // Verify webhook signature
    if (WEBHOOK_SECRET && shopifyHmac) {
      if (!verifyWebhookSignature(body, shopifyHmac, WEBHOOK_SECRET)) {
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        )
      }
    }

    // Parse the webhook payload
    let eventData: ShopifyWebhookEvent
    try {
      eventData = JSON.parse(body)
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Check for duplicate webhooks
    if (webhookId && await isDuplicateWebhook(webhookId)) {
      return NextResponse.json({ status: 'duplicate processed' })
    }

    // Process the webhook based on topic
    await processShopifyWebhook(shopifyTopic, shopifyShop, eventData, webhookId || '')

    return NextResponse.json({ status: 'processed' })
  } catch (error) {
    console.error('Shopify webhook error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Verify Shopify webhook signature
 */
function verifyWebhookSignature(body: string, receivedSignature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(body, 'utf8')
  const calculatedSignature = hmac.digest('base64')

  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature, 'base64'),
    Buffer.from(calculatedSignature, 'base64')
  )
}

/**
 * Check if webhook has already been processed
 */
async function isDuplicateWebhook(webhookId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('sync_logs')
    .select('id')
    .eq('request_data->webhook_id', webhookId)
    .limit(1)
    .single()

  return !!data
}

/**
 * Process Shopify webhook events
 */
async function processShopifyWebhook(
  topic: string,
  shop: string,
  eventData: ShopifyWebhookEvent,
  webhookId: string
): Promise<void> {
  console.log(`Processing Shopify webhook: ${topic} from ${shop}`)
  try {
    switch (topic) {
      case 'products/create':
        await handleProductCreate(eventData, shop, webhookId)
        break

      case 'products/update':
        await handleProductUpdate(eventData, shop, webhookId)
        break

      case 'products/delete':
        await handleProductDelete(eventData, shop, webhookId)
        break

      case 'inventory_levels/update':
        await handleInventoryUpdate(eventData, shop, webhookId)
        break

      default:
        console.log(`Unhandled webhook topic: ${topic}`)
    }
  } catch (error) {
    console.error(`Error processing webhook ${topic}:`, error)

    // Log the error for debugging - using service role client to bypass RLS
    try {
      const supabase = createServiceRoleClient()
      await supabase
        .from('sync_logs')
        .insert({
          product_id: null, // Webhook-level log, not tied to specific product
          platform: Platform.SHOPIFY,
          operation: 'webhook' as SyncOperation,
          status: LogStatus.ERROR,
          message: `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          request_data: { topic, shop, webhookId, eventData },
        })
    } catch (logError) {
      console.error('Failed to log webhook error:', logError)
    }
  }
}

/**
 * Handle product creation webhook
 */
async function handleProductCreate(
  product: ShopifyWebhookEvent,
  shop: string,
  webhookId: string
): Promise<void> {
  // Use service-role client so that we bypass RLS when acting on behalf of the user
  const supabase = createServiceRoleClient()

  // 1.  Check if this Shopify product is already mapped
  const { data: existingMapping } = await supabase
    .from('channel_mappings')
    .select('product_id')
    .eq('platform', Platform.SHOPIFY)
    .eq('external_id', product.id.toString())
    .limit(1)
    .maybeSingle()

  if (existingMapping) {
    // Product already exists → treat this as an update instead
    await handleProductUpdate(product, shop, webhookId)
    return
  }

  // 2. Locate the platform connection so we can associate the new product with the correct user
  const { data: connection } = await supabase
    .from('platform_connections')
    .select('user_id, clerk_user_id')
    .eq('platform', Platform.SHOPIFY)
    .eq('credentials->>shop_domain', shop)
    .single()

  if (!connection) {
    console.warn(`No platform connection found for shop ${shop}. Skipping product import.`)
    return
  }

  const firstVariant = product.variants[0]

  // 3. Insert the new product
  const { data: newProduct, error: prodError } = await supabase
    .from('products')
    .insert({
      user_id: connection.user_id,
      clerk_user_id: connection.clerk_user_id,
      title: product.title,
      description: product.body_html.replace(/<[^>]*>/g, ''),
      price: firstVariant ? parseFloat(firstVariant.price) : null,
      inventory: firstVariant ? firstVariant.inventory_quantity : 0,
      sku: firstVariant ? firstVariant.sku : null,
      brand: product.vendor,
      category: product.product_type,
      tags: product.tags ? product.tags.split(',').map(tag => tag.trim()) : [],
      status: mapShopifyStatus(product.status),
      images: product.images.map(img => img.src),
      created_at: product.created_at,
      updated_at: product.updated_at,
    })
    .select()
    .single()

  if (prodError || !newProduct) {
    throw new Error(`Failed to insert product ${product.id}: ${prodError?.message}`)
  }

  // 4. Create the channel mapping so future webhooks resolve quickly
  await supabase
    .from('channel_mappings')
    .upsert({
      product_id: newProduct.id,
      platform: Platform.SHOPIFY,
      external_id: product.id.toString(),
      sync_status: SyncStatus.SUCCESS,
      last_synced: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'external_id,platform' })

  // 5. Log the operation using service role client
  await supabase
    .from('sync_logs')
    .insert({
      product_id: newProduct.id,
      platform: Platform.SHOPIFY,
      operation: 'create' as SyncOperation,
      status: LogStatus.SUCCESS,
      message: `Product imported from Shopify create webhook`,
      request_data: { webhookId, productId: product.id },
      response_data: product,
    })
}

/**
 * Handle product update webhook
 */
async function handleProductUpdate(
  product: ShopifyWebhookEvent,
  shop: string,
  webhookId: string
): Promise<void> {
  // Use service-role client to avoid RLS issues and guarantee update
  const supabase = createServiceRoleClient()

  // Find the product in our system
  const { data: mapping, error: mapErr } = await supabase
    .from('channel_mappings')
    .select('product_id, products(*)')
    .eq('platform', Platform.SHOPIFY)
    .eq('external_id', product.id.toString())
    .limit(1)
    .maybeSingle()

  if (mapErr) {
    console.warn('Mapping fetch error:', mapErr.message)
    return
  }

  if (!mapping) {
    console.log(`Product not found in our system: ${product.id}`)
    return
  }

  // Supabase may return `products` as an array – grab the first element for typing convenience
  const localProduct = Array.isArray(mapping.products) ? mapping.products[0] : mapping.products as any
  const shopifyUpdated = new Date(product.updated_at)
  const localUpdated = new Date(localProduct.updated_at as unknown as string)

  if (shopifyUpdated > localUpdated) {
    // Update local product with Shopify data
    const firstVariant = product.variants[0]

    await supabase
      .from('products')
      .update({
        title: product.title,
        description: product.body_html.replace(/<[^>]*>/g, ''), // Strip HTML
        price: firstVariant ? parseFloat(firstVariant.price) : null,
        inventory: firstVariant ? firstVariant.inventory_quantity : null,
        brand: product.vendor,
        category: product.product_type,
        tags: product.tags ? product.tags.split(',').map(tag => tag.trim()) : [],
        status: mapShopifyStatus(product.status),
        images: product.images.map(img => img.src),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping.product_id)

    await updateSyncStatus(
      mapping.product_id,
      Platform.SHOPIFY,
      SyncStatus.SUCCESS
    )

    // Log using service role client to ensure webhook can write
    await supabase
      .from('sync_logs')
      .insert({
        product_id: mapping.product_id,
        platform: Platform.SHOPIFY,
        operation: 'update' as SyncOperation,
        status: LogStatus.SUCCESS,
        message: `Product updated from Shopify webhook`,
        request_data: { webhookId, productId: product.id },
        response_data: product,
      })
  }
}

/**
 * Handle product deletion webhook
 */
async function handleProductDelete(
  product: ShopifyWebhookEvent,
  shop: string,
  webhookId: string
): Promise<void> {
  const supabase = createServiceRoleClient()

  // Find the product in our system
  const { data: mapping } = await supabase
    .from('channel_mappings')
    .select('product_id')
    .eq('platform', Platform.SHOPIFY)
    .eq('external_id', product.id.toString())
    .single()

  if (!mapping) {
    console.log(`Deleted product not found in our system: ${product.id}`)
    return
  }

  // Mark the channel mapping as deleted
  await supabase
    .from('channel_mappings')
    .update({
      sync_status: 'deleted',
      error_message: 'Product deleted in Shopify',
      updated_at: new Date().toISOString(),
    })
    .eq('product_id', mapping.product_id)
    .eq('platform', Platform.SHOPIFY)

  // Log using service role client
  await supabase
    .from('sync_logs')
    .insert({
      product_id: mapping.product_id,
      platform: Platform.SHOPIFY,
      operation: 'delete' as SyncOperation,
      status: LogStatus.SUCCESS,
      message: `Product deleted in Shopify`,
      request_data: { webhookId, productId: product.id },
      response_data: product,
    })
}

/**
 * Handle inventory update webhook
 */
async function handleInventoryUpdate(
  eventData: any,
  shop: string,
  webhookId: string
): Promise<void> {
  // Inventory webhooks have a different structure
  console.log(`Inventory updated for variant ${eventData.inventory_item_id}`)

  // This would require mapping inventory items to our products
  // Implementation depends on how we track inventory in our system

  // Log inventory update using service role client to bypass RLS
  try {
    const supabase = createServiceRoleClient()
    await supabase
      .from('sync_logs')
      .insert({
        product_id: null, // Inventory-level log, not tied to specific product yet
        platform: Platform.SHOPIFY,
        operation: 'update' as SyncOperation,
        status: LogStatus.SUCCESS,
        message: `Inventory updated`,
        request_data: { webhookId, inventoryItemId: eventData.inventory_item_id },
        response_data: eventData,
      })
  } catch (logError) {
    console.error('Failed to log inventory update:', logError)
  }
}

/**
 * Map Shopify status to our internal status
 */
function mapShopifyStatus(shopifyStatus: string): string {
  switch (shopifyStatus) {
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