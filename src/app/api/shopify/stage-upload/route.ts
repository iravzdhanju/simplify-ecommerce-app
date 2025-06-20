import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { getActiveShopifyConnections } from '@/lib/supabase/platform-connections'
import { z } from 'zod'

const stageUploadSchema = z.object({
    filename: z.string().min(1, 'Filename is required'),
    mimeType: z.string().min(1, 'MIME type is required'),
    fileSize: z.number().positive('File size must be positive').optional(),
})

export async function POST(req: NextRequest) {
    try {
        await requireAuth()

        const body = await req.json()
        const { filename, mimeType, fileSize } = stageUploadSchema.parse(body)

        console.log('📤 Staging upload for:', { filename, mimeType, fileSize })

        // Get Shopify connections
        const connections = await getActiveShopifyConnections()

        if (connections.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No active Shopify connections found. Please set up a Shopify connection first.'
            }, { status: 400 })
        }

        const connection = connections[0] // Use first active connection

        if (!connection.credentials) {
            return NextResponse.json({
                success: false,
                error: 'Shopify connection has no credentials'
            }, { status: 400 })
        }

        // Type the credentials properly
        const credentials = connection.credentials as {
            shop_domain: string
            access_token: string
            scope?: string
        }

        // Import Shopify GraphQL client and queries
        const { ShopifyGraphQLClient } = await import('@/lib/shopify/client')
        const { CREATE_STAGED_UPLOADS_MUTATION } = await import('@/lib/shopify/queries')

        // Create GraphQL client
        const client = new ShopifyGraphQLClient({
            shopDomain: credentials.shop_domain,
            accessToken: credentials.access_token,
        })

        // Prepare staged upload input
        const stagedUploadInput: any = {
            resource: 'IMAGE',
            filename,
            mimeType,
            httpMethod: 'POST'
        }

        // Add fileSize if provided (must be string for Shopify GraphQL)
        if (fileSize) {
            stagedUploadInput.fileSize = fileSize.toString()
        }

        console.log('🚀 Calling stagedUploadsCreate with:', stagedUploadInput)

        // Step 1: Create staged upload
        const result = await client.executeQuery(CREATE_STAGED_UPLOADS_MUTATION, {
            input: [stagedUploadInput]
        })

        if (result.stagedUploadsCreate.userErrors.length > 0) {
            const error = result.stagedUploadsCreate.userErrors[0]
            console.error('❌ Staging error:', error)
            return NextResponse.json({
                success: false,
                error: `Shopify staging failed: ${error.message}`
            }, { status: 400 })
        }

        const stagedTargets = result.stagedUploadsCreate.stagedTargets
        if (!stagedTargets || stagedTargets.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No staged targets returned from Shopify'
            }, { status: 400 })
        }

        const stagedTarget = stagedTargets[0]
        console.log('✅ Staging successful:', {
            uploadUrl: stagedTarget.url,
            resourceUrl: stagedTarget.resourceUrl,
            parametersCount: stagedTarget.parameters.length
        })

        return NextResponse.json({
            success: true,
            stagedTarget: {
                url: stagedTarget.url,
                resourceUrl: stagedTarget.resourceUrl,
                parameters: stagedTarget.parameters
            }
        })

    } catch (error) {
        console.error('❌ Stage upload API error:', error)

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
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to stage upload'
            },
            { status: 500 }
        )
    }
} 