import { NextRequest, NextResponse } from 'next/server'
import {
  getUserPlatformConnections,
  createPlatformConnection
} from '@/lib/supabase/platform-connections'
import { requireAuth } from '@/lib/supabase/auth'
import { Platform, ShopifyCredentials } from '@/types/database'
import { z } from 'zod'

const createConnectionSchema = z.object({
  platform: z.enum(['shopify', 'amazon']),
  connection_name: z.string().min(1, 'Connection name is required'),
  credentials: z.object({
    // Shopify credentials
    access_token: z.string().optional(),
    shop_domain: z.string().optional(),
    scope: z.string().optional(),
    // Amazon credentials
    seller_id: z.string().optional(),
    marketplace_id: z.string().optional(),
    refresh_token: z.string().optional(),
  }),
  configuration: z.object({
    auto_sync: z.boolean().default(false),
    sync_inventory: z.boolean().default(true),
    sync_prices: z.boolean().default(true),
    sync_images: z.boolean().default(true),
  }).default({}),
})

export async function GET() {
  try {
    requireAuth()

    const connections = await getUserPlatformConnections()

    return NextResponse.json({
      success: true,
      data: connections,
    })
  } catch (error) {
    console.error('GET /api/platform-connections error:', error)

    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch platform connections' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAuth()

    const body = await req.json()
    const validatedData = createConnectionSchema.parse(body)

    const connection = await createPlatformConnection(
      validatedData.platform as Platform,
      validatedData.connection_name,
      validatedData.credentials as ShopifyCredentials,
      validatedData.configuration
    )

    return NextResponse.json({
      success: true,
      data: connection,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/platform-connections error:', error)

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
      { success: false, error: 'Failed to create platform connection' },
      { status: 500 }
    )
  }
}