import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { getActiveShopifyConnections } from '@/lib/supabase/platform-connections'
import { createClient } from '@/lib/supabase/server'
import { getClerkUserId } from '@/lib/supabase/auth'

/**
 * Bulk import products from Shopify to local database
 */
export async function POST() {
  try {
    await requireAuth()
    const clerkUserId = await getClerkUserId()

    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Get active Shopify connections
    const connections = await getActiveShopifyConnections()

    if (connections.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active Shopify connections found. Please connect your Shopify store first.',
        data: {
          imported: 0,
          skipped: 0,
          errors: []
        }
      })
    }

    const connection = connections[0]
    const credentials = connection.credentials as any
    const shopDomain = credentials?.shop_domain
    const accessToken = credentials?.access_token

    if (!shopDomain || !accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Shopify credentials',
        data: {
          imported: 0,
          skipped: 0,
          errors: []
        }
      })
    }

    console.log(`Starting bulk import from Shopify store: ${shopDomain}`)

    // Log import start
    const supabase = await createClient()
    const { data: logData } = await supabase
      .from('sync_logs')
      .insert({
        product_id: 'bulk-import', // Special ID for bulk operations
        platform: 'shopify',
        operation: 'bulk_import',
        status: 'pending',
        message: `Starting bulk import from ${shopDomain}`,
        request_data: { shop_domain: shopDomain }
      })
      .select()
      .single()

    // Fetch products from Shopify
    const shopifyProducts = await fetchAllShopifyProducts(shopDomain, accessToken)

    if (shopifyProducts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products found in Shopify store',
        data: {
          imported: 0,
          skipped: 0,
          errors: []
        }
      })
    }

    console.log(`Found ${shopifyProducts.length} products in Shopify store`)

    if (shopifyProducts.length > 0) {
      console.log('Sample product:', {
        id: shopifyProducts[0].id,
        title: shopifyProducts[0].title,
        vendor: shopifyProducts[0].vendor,
        status: shopifyProducts[0].status
      })
    }

    // Import products to Supabase
    const importResult = await importProductsToSupabase(shopifyProducts, clerkUserId)

    console.log(`Import completed: ${importResult.imported} imported, ${importResult.skipped} skipped, ${importResult.errors.length} errors`)

    // Log import completion
    if (logData) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'success',
          message: `Import completed: ${importResult.imported} imported, ${importResult.skipped} skipped`,
          response_data: importResult,
          execution_time: Date.now() - new Date(logData.created_at).getTime()
        })
        .eq('id', logData.id)
    }

    return NextResponse.json({
      success: true,
      message: `Import completed. ${importResult.imported} products imported, ${importResult.skipped} skipped.`,
      data: importResult
    })

  } catch (error) {
    console.error('Bulk import error:', error)

    // Log import error
    try {
      const supabase = await createClient()
      await supabase
        .from('sync_logs')
        .insert({
          product_id: 'bulk-import',
          platform: 'shopify',
          operation: 'bulk_import',
          status: 'error',
          message: error instanceof Error ? error.message : 'Import failed',
          response_data: { error: error instanceof Error ? error.message : 'Unknown error' }
        })
    } catch (logError) {
      console.error('Failed to log import error:', logError)
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Import failed',
        data: {
          imported: 0,
          skipped: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        }
      },
      { status: 500 }
    )
  }
}

/**
 * Fetch all products from Shopify (handles pagination)
 */
async function fetchAllShopifyProducts(shopDomain: string, accessToken: string): Promise<any[]> {
  const allProducts: any[] = []
  let nextPageInfo: string | null = null
  const limit = 50 // Shopify's max per page

  try {
    do {
      let url = `https://${shopDomain}/admin/api/2025-04/products.json?limit=${limit}`

      if (nextPageInfo) {
        url += `&page_info=${nextPageInfo}`
      }

      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const products = data.products || []

      allProducts.push(...products)
      console.log(`Fetched ${products.length} products (total: ${allProducts.length})`)

      // Check for next page using Link header
      const linkHeader = response.headers.get('Link')
      nextPageInfo = extractNextPageInfo(linkHeader)

    } while (nextPageInfo)

    return allProducts
  } catch (error) {
    console.error('Error fetching products from Shopify:', error)
    throw error
  }
}

/**
 * Extract next page info from Link header
 */
function extractNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null

  const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
  return nextMatch ? nextMatch[1] : null
}

/**
 * Import products to Supabase database
 */
async function importProductsToSupabase(
  shopifyProducts: any[],
  clerkUserId: string
): Promise<{
  imported: number
  skipped: number
  errors: string[]
}> {
  const supabase = await createClient()
  const errors: string[] = []
  let imported = 0
  let skipped = 0

  // Get user ID for product creation
  let userId: string | null = null
  try {
    const { getAuthenticatedUserId } = await import('@/lib/supabase/auth')
    userId = await getAuthenticatedUserId()
  } catch (error) {
    console.warn('Could not get authenticated user ID for product import:', error)
    // Use clerk_user_id as fallback
    userId = clerkUserId
  }

  // Get existing channel mappings to avoid importing the same Shopify products
  const { data: existingMappings } = await supabase
    .from('channel_mappings')
    .select('external_id, product_id')
    .eq('platform', 'shopify')

  const existingShopifyIds = new Set(
    existingMappings?.map(m => m.external_id).filter(Boolean) || []
  )

  // Also get existing products to check for duplicates by SKU/title
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, title, sku')
    .eq('clerk_user_id', clerkUserId)

  const existingSkus = new Set(
    existingProducts?.map(p => p.sku).filter(Boolean) || []
  )
  const existingTitles = new Set(
    existingProducts?.map(p => p.title) || []
  )

  for (const shopifyProduct of shopifyProducts) {
    try {
      const shopifyProductId = shopifyProduct.id?.toString()

      // Skip if this Shopify product is already imported
      if (shopifyProductId && existingShopifyIds.has(shopifyProductId)) {
        skipped++
        continue
      }

      // Transform Shopify product to Supabase format
      const productData = transformShopifyProduct(shopifyProduct)

      // Skip if product already exists (by SKU or title)
      if (
        (productData.sku && existingSkus.has(productData.sku)) ||
        existingTitles.has(productData.title)
      ) {
        skipped++
        continue
      }

      // Insert product
      const { data: insertedProduct, error: productError } = await supabase
        .from('products')
        .insert({
          ...productData,
          user_id: userId,
          clerk_user_id: clerkUserId,
        })
        .select()
        .single()

      if (productError) {
        errors.push(`Failed to import "${productData.title}": ${productError.message}`)
        continue
      }

      // Create channel mapping to track this Shopify product
      if (shopifyProductId && insertedProduct) {
        const { error: mappingError } = await supabase
          .from('channel_mappings')
          .insert({
            product_id: insertedProduct.id,
            platform: 'shopify',
            external_id: shopifyProductId,
            sync_status: 'success',
            last_synced: new Date().toISOString(),
          })

        if (mappingError) {
          console.warn(`Failed to create channel mapping for product ${insertedProduct.id}:`, mappingError)
          // Don't fail the import for mapping errors
        }
      }

      imported++

      // Add small delay to avoid rate limiting
      if (imported % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Failed to process product "${shopifyProduct.title}": ${errorMsg}`)
    }
  }

  return { imported, skipped, errors }
}

/**
 * Transform Shopify product to Supabase product format
 */
function transformShopifyProduct(shopifyProduct: any) {
  const firstVariant = shopifyProduct.variants?.[0] || {}

  return {
    title: shopifyProduct.title || 'Untitled Product',
    description: stripHtml(shopifyProduct.body_html || ''),
    price: parseFloat(firstVariant.price) || 0,
    category: shopifyProduct.product_type || 'Uncategorized',
    sku: firstVariant.sku || null,
    brand: shopifyProduct.vendor || null,
    inventory: parseInt(firstVariant.inventory_quantity) || 0,
    images: (shopifyProduct.images || []).map((img: any) => img.src).slice(0, 5), // Limit to 5 images
    tags: shopifyProduct.tags ? shopifyProduct.tags.split(',').map((t: string) => t.trim()) : [],
    status: mapShopifyStatus(shopifyProduct.status),
    weight: parseFloat(firstVariant.weight) || null,
  }
}

/**
 * Strip HTML tags from description
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

/**
 * Map Shopify status to our status format
 */
function mapShopifyStatus(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'active'
    case 'draft':
      return 'draft'
    case 'archived':
      return 'inactive'
    default:
      return 'active'
  }
}

/**
 * GET /api/sync/shopify/bulk/status
 * Get status of ongoing bulk operations
 */
export async function GET(req: NextRequest) {
  try {
    requireAuth()

    // This would track ongoing bulk operations
    // For now, return a simple status

    return NextResponse.json({
      success: true,
      data: {
        activeBulkOperations: 0,
        lastBulkSync: null,
        nextScheduledSync: null,
      },
    })

  } catch (error) {
    console.error('GET /api/sync/shopify/bulk/status error:', error)

    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get bulk sync status' },
      { status: 500 }
    )
  }
}