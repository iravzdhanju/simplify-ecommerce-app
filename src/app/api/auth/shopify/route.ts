import { NextRequest, NextResponse } from 'next/server'
import { createShopifyOAuth } from '@/lib/shopify/oauth'
import { requireAuth } from '@/lib/supabase/auth'
import { z } from 'zod'

const initiateOAuthSchema = z.object({
  shop: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/, 'Invalid shop domain'),
  connectionName: z.string().min(1, 'Connection name is required'),
})

/**
 * POST /api/auth/shopify
 * Initiate Shopify OAuth flow
 */
export async function POST(req: NextRequest) {
  try {
    const clerkUserId = requireAuth()
    
    const body = await req.json()
    const { shop, connectionName } = initiateOAuthSchema.parse(body)
    
    const shopifyOAuth = createShopifyOAuth()
    const { url, state } = shopifyOAuth.generateAuthUrl(shop, clerkUserId)
    
    // Store state in session or database for validation
    // For now, we'll return it to be stored client-side
    // In production, consider storing in Redis or database
    
    return NextResponse.json({
      success: true,
      data: {
        authUrl: url,
        state,
        shop,
        connectionName,
      },
    })
  } catch (error) {
    console.error('POST /api/auth/shopify error:', error)
    
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
      { success: false, error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    )
  }
}