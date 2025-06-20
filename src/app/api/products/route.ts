import { NextRequest, NextResponse } from 'next/server'
import { getUserProducts, createProduct } from '@/lib/supabase/products'
import { requireAuth } from '@/lib/supabase/auth'
import { getActiveShopifyConnections } from '@/lib/supabase/platform-connections'
import { ensureUserInDatabase } from '@/lib/user-management'
import { z } from 'zod'

const createProductSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive').optional(),
  inventory: z.number().int().min(0, 'Inventory cannot be negative').default(0),
  images: z.array(z.string().url()).default([]),
  sku: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(['in', 'cm', 'ft', 'm']),
  }).optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['active', 'inactive', 'draft']).default('active'),
})

/**
 * Stage image uploads and get CDN URLs using official Shopify flow
 */
async function stageImageUploads(client: any, imageUrls: string[]) {
  if (!imageUrls.length) return []

  try {
    console.log('🖼️ Staging uploads for images:', imageUrls)

    const { CREATE_STAGED_UPLOADS_MUTATION } = await import('@/lib/shopify/queries')

    // Prepare staged upload inputs for each image
    const stagedUploadInputs = imageUrls.map((imageUrl, index) => {
      // Extract filename from URL or create a default one
      const filename = imageUrl.split('/').pop()?.split('?')[0] || `image-${index + 1}.jpg`

      return {
        resource: 'IMAGE',
        filename,
        mimeType: 'image/jpeg', // Default to JPEG, could be enhanced to detect actual type
        httpMethod: 'POST'
      }
    })

    // Step 1: Create staged uploads
    const stagingResult = await client.executeQuery(CREATE_STAGED_UPLOADS_MUTATION, {
      input: stagedUploadInputs
    })

    if (stagingResult.stagedUploadsCreate.userErrors.length > 0) {
      console.error('❌ Staging errors:', stagingResult.stagedUploadsCreate.userErrors)
      throw new Error(`Failed to stage uploads: ${stagingResult.stagedUploadsCreate.userErrors[0].message}`)
    }

    const stagedTargets = stagingResult.stagedUploadsCreate.stagedTargets
    console.log('✅ Staged targets created:', stagedTargets.length)

    // Step 2: Upload each image to its staged target URL
    const uploadPromises = stagedTargets.map(async (target: any, index: number) => {
      try {
        const imageUrl = imageUrls[index]
        console.log(`📤 Uploading image ${index + 1}:`, imageUrl)

        // Download the image from the source URL
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image from ${imageUrl}: ${imageResponse.statusText}`)
        }

        const imageBlob = await imageResponse.blob()
        console.log(`📦 Image ${index + 1} size:`, imageBlob.size, 'bytes')

        // Prepare form data for upload
        const formData = new FormData()

        // Add all the required parameters from Shopify
        target.parameters.forEach((param: any) => {
          formData.append(param.name, param.value)
        })

        // Add the file as the last field (important for Shopify)
        formData.append('file', imageBlob, `image-${index + 1}.jpg`)

        // Upload to the staged target URL
        const uploadResponse = await fetch(target.url, {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          console.error(`❌ Upload failed for image ${index + 1}:`, uploadResponse.status, errorText)
          throw new Error(`Upload failed: ${uploadResponse.statusText}`)
        }

        console.log(`✅ Image ${index + 1} uploaded successfully to:`, target.resourceUrl)
        return target.resourceUrl

      } catch (error) {
        console.error(`❌ Failed to upload image ${index + 1}:`, error)
        throw error
      }
    })

    // Wait for all uploads to complete
    const uploadedImageUrls = await Promise.all(uploadPromises)
    console.log('🎉 All images uploaded successfully:', uploadedImageUrls)

    return uploadedImageUrls

  } catch (error) {
    console.error('❌ Image staging/upload failed:', error)
    throw error
  }
}

/**
 * Create product in Shopify first (source of truth) using official two-step flow
 */
async function createProductInShopify(productData: any) {
  try {
    // Get Shopify connections
    const connections = await getActiveShopifyConnections()

    if (connections.length === 0) {
      return {
        success: false,
        error: 'No active Shopify connections found. Please set up a Shopify connection first.'
      }
    }

    const connection = connections[0] // Use first active connection

    if (!connection.credentials) {
      return {
        success: false,
        error: 'Shopify connection has no credentials'
      }
    }

    // Type the credentials properly
    const credentials = connection.credentials as {
      shop_domain: string
      access_token: string
      scope?: string
    }

    // Import Shopify sync classes
    const { ShopifyGraphQLClient } = await import('@/lib/shopify/client')
    const { CREATE_PRODUCT_MUTATION } = await import('@/lib/shopify/queries')

    // Create GraphQL client
    const client = new ShopifyGraphQLClient({
      shopDomain: credentials.shop_domain,
      accessToken: credentials.access_token,
    })

    // Step 1: Stage and upload images using official Shopify flow
    let mediaData: Array<{ originalSource: string; mediaContentType: 'IMAGE' }> = []
    if (productData.images && productData.images.length > 0) {
      try {
        const uploadedImageUrls = await stageImageUploads(client, productData.images)

        // Prepare media data with the uploaded CDN URLs
        mediaData = uploadedImageUrls.map((cdnUrl: string) => ({
          originalSource: cdnUrl,
          mediaContentType: 'IMAGE' as const,
        }))

        console.log('🖼️ Prepared media data:', mediaData)
      } catch (imageError) {
        console.warn('⚠️ Image upload failed, creating product without images:', imageError)
        // Continue without images rather than failing completely
      }
    }

    // Step 2: Create product with the uploaded media
    const shopifyProductData = {
      title: productData.title,
      descriptionHtml: productData.description || '',
      productType: productData.category || '',
      vendor: productData.brand || '',
      tags: productData.tags || [],
      status: productData.status === 'active' ? 'ACTIVE' : 'DRAFT',
      productOptions: [], // Basic product without variants for now
      seo: {
        title: productData.title,
        description: productData.description || '',
      },
    }

    console.log('🛍️ Creating product in Shopify with data:', {
      title: shopifyProductData.title,
      mediaCount: mediaData.length
    })

    // Execute GraphQL mutation
    const result = await client.executeQuery(CREATE_PRODUCT_MUTATION, {
      product: shopifyProductData,
      media: mediaData.length > 0 ? mediaData : undefined
    })

    if (result.productCreate.userErrors.length > 0) {
      const error = result.productCreate.userErrors[0]
      console.error('❌ Shopify product creation error:', error)
      return {
        success: false,
        error: `Shopify API error: ${error.message}`
      }
    }

    const createdProduct = result.productCreate.product
    const firstVariant = createdProduct.variants.edges[0]?.node

    console.log('✅ Product created successfully in Shopify:', {
      id: createdProduct.id,
      handle: createdProduct.handle,
      mediaCount: createdProduct.media?.edges?.length || 0
    })

    return {
      success: true,
      shopifyId: createdProduct.id,
      variantId: firstVariant?.id,
      handle: createdProduct.handle,
      shopDomain: credentials.shop_domain
    }

  } catch (error) {
    console.error('Error creating product in Shopify:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating product in Shopify'
    }
  }
}

export async function GET() {
  try {
    await requireAuth()

    const products = await getUserProducts()

    // Transform products to match the expected API format
    const transformedProducts = products.map(product => ({
      id: product.id,
      name: product.title,
      description: product.description || '',
      price: product.price || 0,
      category: product.category || 'Uncategorized',
      photo_url: product.images?.[0] || null,
      created_at: product.created_at,
      updated_at: product.updated_at,
      marketplace: ['Shopify'], // Default marketplace
      sku: product.sku,
      brand: product.brand,
      inventory: product.inventory,
      status: product.status,
      tags: product.tags || [],
      images: product.images || [],
    }))

    return NextResponse.json({
      success: true,
      data: transformedProducts,
    })
  } catch (error) {
    console.error('GET /api/products error:', error)

    if (error instanceof Error && (
      error.message === 'Authentication required' ||
      error.message === 'Unauthorized: User must be authenticated' ||
      error.message === 'User not authenticated'
    )) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    // IMPORTANT: Ensure user exists in database before any operations
    const user = await ensureUserInDatabase()
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create user record in database',
        step: 'user_creation'
      }, { status: 500 })
    }

    const body = await req.json()
    const validatedData = createProductSchema.parse(body)

    // Step 1: Create product in Shopify FIRST
    try {
      const shopifyResult = await createProductInShopify(validatedData)

      if (!shopifyResult.success) {
        return NextResponse.json({
          success: false,
          error: `Shopify creation failed: ${shopifyResult.error}`,
          step: 'shopify_creation'
        }, { status: 400 })
      }

      // Step 2: Save to Supabase 
      const localProduct = await createProduct(validatedData)

      // Step 3: Create channel mapping to link local and Shopify products
      const { upsertChannelMapping } = await import('@/lib/supabase/sync')
      const { Platform, SyncStatus } = await import('@/types/database')

      await upsertChannelMapping(localProduct.id, Platform.SHOPIFY, {
        external_id: shopifyResult.shopifyId,
        sync_status: SyncStatus.SUCCESS,
        sync_data: {
          shopify_product_id: shopifyResult.shopifyId,
          variant_id: shopifyResult.variantId,
          handle: shopifyResult.handle,
          shop_domain: shopifyResult.shopDomain
        },
      })

      return NextResponse.json({
        success: true,
        data: localProduct,
        shopify: {
          id: shopifyResult.shopifyId,
          handle: shopifyResult.handle,
          admin_url: `https://${shopifyResult.shopDomain}/admin/products/${shopifyResult.shopifyId.split('/').pop()}`
        }
      }, { status: 201 })

    } catch (shopifyError) {
      console.error('Shopify product creation failed:', shopifyError)

      return NextResponse.json({
        success: false,
        error: shopifyError instanceof Error ? shopifyError.message : 'Failed to create product in Shopify',
        step: 'shopify_creation'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('POST /api/products error:', error)

    if (error instanceof Error && (
      error.message === 'Authentication required' ||
      error.message === 'Unauthorized: User must be authenticated' ||
      error.message === 'User not authenticated'
    )) {
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
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    )
  }
}