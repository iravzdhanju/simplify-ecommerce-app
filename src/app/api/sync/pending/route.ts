import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { shopifySyncManager } from '@/lib/shopify/sync-manager'
import { getProductsNeedingSync } from '@/lib/supabase/sync'
import { Platform } from '@/types/database'
import { z } from 'zod'

const pendingSyncSchema = z.object({
  connectionId: z.string().uuid('Invalid connection ID').optional(),
  platform: z.enum(['shopify', 'amazon']).default('shopify'),
  autoFix: z.boolean().default(false)
})

/**
 * GET /api/sync/pending
 * Get products that need syncing
 */
export async function GET(req: NextRequest) {
  try {
    requireAuth()
    
    const { searchParams } = new URL(req.url)
    const platform = searchParams.get('platform') || 'shopify'
    
    const pendingProducts = await getProductsNeedingSync(
      platform as Platform
    )

    return NextResponse.json({
      success: true,
      data: {
        platform,
        totalPending: pendingProducts.length,
        products: pendingProducts.map(mapping => ({
          productId: mapping.product_id,
          platform: mapping.platform,
          syncStatus: mapping.sync_status,
          lastSynced: mapping.last_synced,
          errorMessage: mapping.error_message,
          errorCount: mapping.error_count,
          product: mapping.products
        }))
      }
    })
    
  } catch (error) {
    console.error('GET /api/sync/pending error:', error)
    
    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to get pending products' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sync/pending
 * Sync all pending products
 */
export async function POST(req: NextRequest) {
  try {
    requireAuth()
    
    const body = await req.json()
    const { connectionId, platform, autoFix } = pendingSyncSchema.parse(body)
    
    await shopifySyncManager.initialize()
    
    if (platform === 'shopify') {
      const result = await shopifySyncManager.syncPendingProducts(connectionId)
      
      return NextResponse.json({
        success: result.success,
        data: {
          platform,
          operation: 'sync_pending',
          totalProcessed: result.totalProcessed,
          successful: result.successful,
          failed: result.failed,
          errors: result.errors,
          processingTime: result.processingTime
        }
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Platform not supported yet' },
        { status: 400 }
      )
    }
    
  } catch (error) {
    console.error('POST /api/sync/pending error:', error)
    
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
      { success: false, error: 'Failed to sync pending products' },
      { status: 500 }
    )
  }
}